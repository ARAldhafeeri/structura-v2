/**
 * In stractura runtime we need helper method that extract the file path from node id
 * nodeId follow specific format to do both tasks act as unique id, and store helpful data
 * the method decode the path then extract the absoulte path.
 * @param nodeId - nodeId in stractura runTime
 * @returns 
 */
export const getFilePathFromNodeId = (nodeId: string) => decodeURIComponent(nodeId).replace(/:\d+:\d+:.+$/, "");