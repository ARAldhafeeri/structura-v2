Please do not use sinon stub on modules, yet to debug it freezes the whole test run.

Util the issue fixed, do not stub modules. Note if you have done this mistake, you need to close all running processors related to the pervious test where you used sinon stub on module, that dangling process will also prevent the test to run.


 The root cause: the old tests only ever call sinon.stub() to create standalone functions — they never do
  sinon.stub(module, 'export'). The new TSParser/FileWatcher/Directory tests were calling sinon.stub(DirectoryModule,
  "getDirectoryTree") and sinon.stub(fs, "readFile"), which attempts to reassign properties on ESM module objects. ESM
  exports are live read-only bindings — sinon hangs trying to intercept them in VS Code's test runner.

  The fix across all three files: removed all sinon.stub(module, export) calls entirely. Tests now use the real
  test/fixtures/sample.ts file and real directory paths, so the actual parsing code runs and we assert on its side
  effects through the ctx stubs — which are plain standalone sinon.stub() functions, exactly like the old tests.