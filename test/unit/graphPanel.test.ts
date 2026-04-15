import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";
import { readFile } from "fs/promises";

// Resolve the HTML path relative to the compiled test location:
// dist/test/unit  →  ../../..  →  project root  →  src/index.html
const HTML_PATH = path.join(__dirname, "..", "..", "..", "src", "index.html");
const html = fs.readFileSync(HTML_PATH, "utf-8");

suite("GraphPanel — src/index.html", () => {

  test("src/index.html exists", () => {
    assert.ok(fs.existsSync(HTML_PATH), "src/index.html must exist");
  });

  test("contains window.__STRACTURA_INITIAL_DATA__ for data injection", () => {
    assert.ok(
      html.includes("window.__STRACTURA_INITIAL_DATA__"),
      "HTML must read from window.__STRACTURA_INITIAL_DATA__",
    );
  });

  test("has a bare <script> tag as the injection point", () => {
    // getWebviewContent() does html.replace('<script>', injection + '\n<script>')
    // so a bare <script> (no attributes) must be present.
    assert.ok(
      html.includes("<script>"),
      "HTML must contain a bare <script> tag for the extension injection",
    );
  });

  test("falls back to empty graph when __STRACTURA_INITIAL_DATA__ is absent", () => {
    // The script should have a fallback like: || { nodes: [], edges: [] }
    assert.ok(
      html.includes("nodes: [], edges: []") || html.includes("{ nodes: [], edges: [] }"),
      "HTML must have an empty-graph fallback",
    );
  });

  test("listens for graphData messages for live updates", () => {
    assert.ok(
      html.includes("'message'") || html.includes('"message"'),
      "HTML must have a window message listener for live graph updates",
    );
    assert.ok(
      html.includes("graphData"),
      "message listener must handle the graphData command",
    );
  });

  test("getWebviewContent injection produces valid script tag pair", () => {
    // Simulate what GraphPanel.getWebviewContent does:
    const fakeData = { nodes: [], edges: [] };
    const injection = `<script>window.__STRACTURA_INITIAL_DATA__ = ${JSON.stringify(fakeData)};</script>`;
    const result = html.replace("<script>", `${injection}\n<script>`);

    // The injected script must appear before the original <script> block.
    const injectionIdx = result.indexOf(injection);
    const originalIdx = result.indexOf("<script>", injectionIdx + injection.length);

    assert.ok(injectionIdx !== -1, "injection must appear in result");
    assert.ok(originalIdx > injectionIdx, "original <script> must follow the injected block");
  });

  test("contains acquireVsCodeApi call", () => {
    assert.ok(
      html.includes("acquireVsCodeApi()"),
      "HTML must call acquireVsCodeApi() to communicate with the extension",
    );
  });
});
