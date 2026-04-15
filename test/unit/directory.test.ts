import * as assert from "assert";
import { getDirectoryTree } from "../../src/core/Directory.js";
import { isDirectoryDepthReached } from "../../src/uitlities/directory.js";

import path from 'node:path';

suite("Tests related to fetching directory trees", () => {
    
  
    test("Test depth checker", async () => {
        assert.strictEqual(isDirectoryDepthReached(0, 0), false);
        assert.strictEqual(isDirectoryDepthReached(1, 0), false);
        assert.strictEqual(isDirectoryDepthReached(0, 1), false);
        assert.strictEqual(isDirectoryDepthReached(1, 1), true);
    });

    test("Directory tree should be fetched correctly bounded search", async () => {
        // test directory is src, depth is 1, so only immediate children should be included

        const testDirectory = path.join(__dirname, "..");


        const tree = await getDirectoryTree(testDirectory, 1);
    
        assert.strictEqual(tree[0].parent, "..\\..\\dist\\test");
    })

    test("Directory tree should be fetched correctly unbounded search", async () => {
        // test directory is src, depth is 0, so all children should be included
        const testDirectory = path.join(__dirname, "..");

        const tree = await getDirectoryTree(testDirectory, 0);

        assert.strictEqual(tree[0].parent, "..\\..\\dist\\test");
        assert.ok(tree.length > 1);

    });

});