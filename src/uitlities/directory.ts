

/**
 * Helper method to determine if the depth of the dir is reached
 * files aren't included as they do not have children
 */
export const isDirectoryDepthReached = ( counter : number, depth : number) => {
    // unbounded depth
    if ( depth === 0) return false;
    // bounded depth 
    return ( counter >= depth);
}