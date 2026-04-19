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

        // Only add nodes that aren't already in the graph.
        const toAnimate = newNodes.filter(nd => !state.cy.$id(nd.id).length);

        if (toAnimate.length === 0) {
          updateStats();
          return;
        }

        // Store current viewport state
        const currentPan = { ...state.cy.pan() };
        const currentZoom = state.cy.zoom();
        const sourceEl = sourceId ? state.cy.$id(sourceId) : null;
        
        // IMPORTANT: Don't use the source node's current position if it might move during layout
        const sourcePos = sourceEl?.length 
          ? { ...sourceEl.position() }
          : { x: state.cy.width() / 2, y: state.cy.height() / 2 };

        // Add all new nodes at source position (invisible initially)
        toAnimate.forEach(nd => {
          state.visibleNodeIds.add(nd.id);
          const cyData = cyNodeData(nd, false);
          cyData.classes = 'pre-enter';
          const el = state.cy.add(cyData);
          // Position at source immediately
          el.position({ ...sourcePos });
        });

        // Add all new edges
        newEdges.forEach(e => addEdgeToGraph(e));

        // Create a subgraph containing only existing nodes + new nodes
        // This prevents the layout from moving existing nodes too aggressively
        const layout = state.cy.layout({
          name: 'cose',
          // Only apply layout to the new nodes and their immediate connections
          // This prevents the entire graph from reorganizing
          componentSpacing: 80,
          nodeRepulsion: function(node) {
            // Existing nodes get higher repulsion to stay in place
            return toAnimate.some(n => n.id === node.id()) ? 4000 : 8000;
          },
          edgeElasticity: 100,
          gravity: 0.25,
          nestingFactor: 1.0,
          coolingFactor: 0.95,
          initialTemp: 200,
          fit: false, // Don't auto-fit, we'll handle viewport manually
          padding: 60,
          animate: false,
          randomize: false,
          // Stop layout early for better performance
          stop: function() {
            return this.initialTemp * Math.pow(this.coolingFactor, this.iterations || 0) < 0.01;
          }
        });

        // Store target positions after layout
        layout.one('layoutstop', () => {
          const targetPositions = new Map();
          toAnimate.forEach(nd => {
            const el = state.cy.$id(nd.id);
            if (el.length) {
              targetPositions.set(nd.id, { ...el.position() });
              // Move back to source position for animation
              el.position({ ...sourcePos });
            }
          });

          // Restore original viewport
          state.cy.viewport({ pan: currentPan, zoom: currentZoom });

          // Animate each node from source to target with requestAnimationFrame for smoother performance
          const startTime = performance.now();
          const duration = 380;
          const staggerDelay = 45;

          toAnimate.forEach((nd, i) => {
            setTimeout(() => {
              const el = state.cy.$id(nd.id);
              const targetPos = targetPositions.get(nd.id);
              if (!el.length || !targetPos) return;
              
              // Remove pre-enter class to make visible
              el.removeClass('pre-enter');
              
              // Use Cytoscape's animate with easing
              el.animate(
                {
                  position: targetPos,
                  style: {
                    'background-opacity': 0.15,
                    'border-opacity': 0.85,
                    'text-opacity': 0.8,
                    'shadow-opacity': 0.4,
                  },
                },
                {
                  duration: duration,
                  easing: 'ease-out-cubic',
                  complete: () => {
                    // Highlight briefly
                    el.addClass('new-node');
                    setTimeout(() => el.removeClass('new-node'), 500);
                  }
                }
              );
            }, i * staggerDelay);
          });

          // Visual feedback at source
          if (sourceId && sourceEl?.length) {
            const rp = sourceEl.renderedPosition();
            const cp = cyPosToContainer(rp);
            spawnRipple(cp.x, cp.y, intentColor[getNode(sourceId)?.intent] || '#00c8ff');
            spawnExpandBadge(cp.x, cp.y - 20, toAnimate.length);
          }

          // Update UI after animations complete
          const batchDelay = toAnimate.length * staggerDelay + duration + 100;
          setTimeout(() => {
            updateStats();
            updateFileTree();
            saveHistory();
            toast(`+${toAnimate.length} nodes`);
            state.currentDepth = Math.min(state.currentDepth + 1, 9);
            updateDepthIndicator(state.currentDepth);
            
            // Smooth fit to include new nodes without jarring transition
            if (toAnimate.length > 0) {
              state.cy.animate({
                fit: {
                  eles: state.cy.elements(),
                  padding: 60
                },
                duration: 400,
                easing: 'ease-in-out-cubic'
              });
            }
          }, batchDelay);
        });

        // Run the layout
        layout.run();
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
