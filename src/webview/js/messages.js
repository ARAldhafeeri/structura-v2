// ── ENGINE MESSAGE LISTENER ───────────────────────────────────────────────────
// Receives async responses posted by processor handlers via ctx.webview.postMessage().
window.addEventListener('message', event => {
  const msg = event.data;
  if (!msg || !msg.command) return;
  console.log('[Stractura] message from engine:', msg.command, msg);

  switch (msg.command) {
    case 'nodesAdded': {
      // Engine responded to an expand-node request.
      const newNodes = (msg.nodes || []).map(toDisplayNode);
      const newEdges = (msg.edges || []).map(e => ({ from: e.from, to: e.to, weight: e.weight || 1 }));

      if (!newNodes.length) {
        toast(msg.reason === 'external' ? 'package import · not explorable' : 'no further nodes to expand');
        return;
      }

      const sourceId = state.expandingFromId;
      state.expandingFromId = null;

      // Register into master data structures.
      newNodes.forEach(nd => {
        if (!nodeMap.has(nd.id)) { nodeMap.set(nd.id, nd); NODES.push(nd); }
      });
      newEdges.forEach(e => {
        if (!EDGES.some(x => x.from === e.from && x.to === e.to)) EDGES.push(e);
      });

      // Determine origin point for radial entrance animation.
      const srcPos = (sourceId && state.cy.$id(sourceId).length)
        ? { ...state.cy.$id(sourceId).position() }
        : { x: state.cy.width() / 2, y: state.cy.height() / 2 };

      // Only add nodes that aren't already in the graph.
      const toAnimate = newNodes.filter(nd => !state.cy.$id(nd.id).length);

      toAnimate.forEach(nd => {
        state.visibleNodeIds.add(nd.id);
        const cyData = cyNodeData(nd, false);
        cyData.classes = 'pre-enter';
        state.cy.add(cyData);
        // Start all new nodes at source position.
        state.cy.$id(nd.id).position({ ...srcPos });
      });

      // Add edges now (they'll be invisible while endpoints are still pre-enter).
      newEdges.forEach(e => addEdgeToGraph(e));

      // Stagger-animate each node outward from source in a radial pattern.
      const count = toAnimate.length;
      toAnimate.forEach((nd, i) => {
        const angle = (2 * Math.PI * i / Math.max(count, 1)) - Math.PI / 2;
        const ring   = Math.floor(i / 8);          // multiple rings for large sets
        const radius = 160 + ring * 80 + (i % 3) * 20;
        const targetPos = {
          x: srcPos.x + Math.cos(angle) * radius,
          y: srcPos.y + Math.sin(angle) * radius,
        };

        setTimeout(() => {
          const el = state.cy.$id(nd.id);
          if (!el.length) return;
          el.animate(
            {
              position: targetPos,
              style: {
                'background-opacity': 0.15, 'border-opacity': 0.85,
                'text-opacity': 0.8, 'shadow-opacity': 0.4,
              },
            },
            { duration: 380, easing: 'ease-out-cubic',
              complete: () => el.removeClass('pre-enter') }
          );
        }, i * 45);
      });

      // Visual ripple at source.
      if (sourceId) {
        const srcEl = state.cy.$id(sourceId);
        if (srcEl.length) {
          const rp = srcEl.renderedPosition();
          const cp = cyPosToContainer(rp);
          spawnRipple(cp.x, cp.y, intentColor[getNode(sourceId)?.intent] || '#00c8ff');
          const pos2 = cyPosToContainer(rp);
          spawnExpandBadge(pos2.x, pos2.y - 20, toAnimate.length);
        }
      }

      // Batch DOM updates after animation starts.
      const batchDelay = toAnimate.length * 45 + 200;
      setTimeout(() => {
        updateStats();
        updateFileTree();
        saveHistory();
        toast(`+${toAnimate.length} nodes`);
        state.currentDepth = Math.min(state.currentDepth + 1, 9);
        updateDepthIndicator(state.currentDepth);
      }, batchDelay);
      break;
    }
    case 'edgesRemoved': {
      (msg.edges || []).forEach(e => {
        const eid = `${e.from}__${e.to}`;
        const el = state.cy.$id(eid);
        if (el.length) state.cy.remove(el);
      });
      updateStats();
      break;
    }
    case 'graphData': {
      // Full graph refresh — update local reference arrays and re-render.
      console.log('[Stractura] full graphData received, nodes:', msg.nodes?.length, 'edges:', msg.edges?.length);
      break;
    }
    case 'highlight': {
      const ids = msg.nodeIds || [];
      state.cy.nodes().forEach(n => n.removeClass('highlighted'));
      ids.forEach(id => state.cy.$id(id).addClass('highlighted'));
      break;
    }
    case 'nodeHidden': {
      // Engine confirmed the node was removed from graph state — sync the view.
      const id = msg.nodeId;
      state.cy.remove(state.cy.$id(id));
      state.visibleNodeIds.delete(id);
      if (state.selectedNodeId === id) {
        state.selectedNodeId = null;
        document.getElementById('sel-name').textContent = '—';
        document.getElementById('detail-panel').classList.remove('open');
      }
      updateStats(); updateFileTree(); saveHistory();
      toast('node hidden');
      break;
    }
    case 'nodePinned': {
      // Engine confirmed pin state change — sync the view.
      const { nodeId, pinned } = msg;
      const el = state.cy.$id(nodeId);
      if (pinned) { state.pinnedNodeIds.add(nodeId); el.addClass('pinned'); el.lock(); toast('pinned'); }
      else { state.pinnedNodeIds.delete(nodeId); el.removeClass('pinned'); el.unlock(); toast('unpinned'); }
      break;
    }
    case 'clearSelection': {
      state.selectedNodeId = null;
      state.cy.elements().unselect();
      state.cy.edges().removeClass('highlighted');
      document.getElementById('sel-name').textContent = '—';
      document.getElementById('detail-panel').classList.remove('open');
      updateFileTree();
      break;
    }
    case 'workspaceReady': {
      // Full workspace parse complete — add all file (Program) nodes at once.
      const newNodes = (msg.nodes || []).map(toDisplayNode);
      const newEdges = (msg.edges || []).map(e => ({ from: e.from, to: e.to, weight: e.weight || 1 }));

      // Merge into master data structures.
      newNodes.forEach(nd => {
        if (!nodeMap.has(nd.id)) { nodeMap.set(nd.id, nd); NODES.push(nd); }
      });
      newEdges.forEach(e => {
        if (!EDGES.some(x => x.from === e.from && x.to === e.to)) EDGES.push(e);
      });

      // Add nodes that aren't already visible.
      const toAdd = newNodes.filter(nd => !state.cy.$id(nd.id).length);
      toAdd.forEach(nd => {
        state.visibleNodeIds.add(nd.id);
        const cyData = cyNodeData(nd, false);
        cyData.classes = (cyData.classes ? cyData.classes + ' ' : '') + 'pre-enter';
        state.cy.add(cyData);
      });
      newEdges.forEach(e => addEdgeToGraph(e));

      // Run a single layout pass then stagger-reveal all new nodes.
      runLayout(true, null, false, () => {
        toAdd.forEach((nd, i) => {
          setTimeout(() => {
            const el = state.cy.$id(nd.id);
            if (!el.length) return;
            el.removeClass('pre-enter');
            el.addClass('new-node');
            setTimeout(() => el.removeClass('new-node'), 500);
          }, i * 18);
        });

        const revealMs = toAdd.length * 18 + 300;
        setTimeout(() => {
          updateStats();
          updateFileTree();
          saveHistory();
          state.currentDepth = 9;
          updateDepthIndicator(9);
          document.getElementById('stat-total').textContent = NODES.length;
          state.cy.fit(undefined, 60);
          toast(`workspace · ${msg.totalFiles || toAdd.length} files loaded`);
          setMsg('full workspace loaded · <strong style="color:var(--accent)">Ctrl+Alt+E</strong> expand any file · <strong style="color:var(--accent)">?</strong> help');
        }, revealMs);
      });
      break;
    }
  }
});
