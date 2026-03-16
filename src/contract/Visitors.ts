// Type for the walk visitor
export type NodeVisitor = {
  [K in string]?: (node: any) => void;
} & {
  // Allow any node type with type safety
  [key: string]: ((node: any) => void) | undefined;
};
