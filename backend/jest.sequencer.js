const Sequencer = require('@jest/test-sequencer').default;

class CustomSequencer extends Sequencer {
  sort(tests) {
    // Define the desired order of test files
    const testOrder = [
      'index.test.ts',
      'service.test.ts',
      'transformer.test.ts',
      'llm.test.ts',
      'cache.test.ts',
      'pager.test.ts'
    ];

    // Create a map for quick lookup of order index
    const orderMap = new Map();
    testOrder.forEach((fileName, index) => {
      orderMap.set(fileName, index);
    });

    // Sort tests based on the defined order
    return tests.sort((testA, testB) => {
      const fileNameA = testA.path.split('/').pop() || '';
      const fileNameB = testB.path.split('/').pop() || '';
      
      const orderA = orderMap.get(fileNameA);
      const orderB = orderMap.get(fileNameB);
      
      // If both files are in our order list, sort by order
      if (orderA !== undefined && orderB !== undefined) {
        return orderA - orderB;
      }
      
      // If only one file is in our order list, prioritize it
      if (orderA !== undefined) return -1;
      if (orderB !== undefined) return 1;
      
      // If neither file is in our order list, maintain original order
      return testA.path.localeCompare(testB.path);
    });
  }
}

module.exports = CustomSequencer;