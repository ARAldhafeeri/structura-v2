import type {
  Parameter,
  SourceLocation,
} from "../contract";


/** Build the stable node id: filePath:line:column:nodeType */
/** 
 * 
*/
export const makeId = (filePath: string, loc: SourceLocation, nodeType: string) =>
  `${filePath}:${loc.start.line}:${loc.start.column}:${nodeType}`;

/** 
 * Convert OXC span { start, end } (byte offsets) + sourceText → line/col 
 * */
export const spanToLoc = (
  span: { start: number; end: number },
  lines: number[]
): SourceLocation => {
  const startLine = findLine(span.start, lines);
  const endLine = findLine(span.end, lines);
  return {
    start: { line: startLine.line, column: span.start - startLine.lineStart },
    end: { line: endLine.line, column: span.end - endLine.lineStart },
  };
};

export const findLine = (offset: number, lineOffsets: number[]) => {
  let lo = 0,
    hi = lineOffsets.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (lineOffsets[mid] <= offset) lo = mid;
    else hi = mid - 1;
  }
  return { line: lo + 1, lineStart: lineOffsets[lo] };
};

/** 
 * Build line-start offsets array from source 
 * */
export const buildLineOffsets = (source: string): number[] => {
  const offsets = [0];
  for (let i = 0; i < source.length; i++) {
    if (source[i] === "\n") offsets.push(i + 1);
  }
  return offsets;
};

/** 
 * Extract text name from an Identifier / BindingIdentifier / etc. 
 **/
export const ident = (node: any): string => node?.name ?? node?.value ?? "anonymous";

/** 
 * Resolve the callee of a CallExpression to a readable string 
 **/
export const resolveCallee = (callee: any): string => {
  if (!callee) return "unknown";
  if (callee.type === "Identifier") return callee.name;
  if (callee.type === "MemberExpression") {
    const obj = resolveCallee(callee.object);
    const prop =
      callee.property?.name ?? callee.property?.value ?? "unknown";
    return `${obj}.${prop}`;
  }
  if (callee.type === "CallExpression") {
    return resolveCallee(callee.callee);
  }
  return "unknown";
};

/** 
 * Extract parameter list from FormalParameters or similar
 **/
export const extractParams = (params: any[]): Parameter[] => {
  if (!Array.isArray(params)) return [];
  return params.map((p: any) => {
    const param: Parameter = { name: "unknown" };

    // BindingIdentifier / Identifier
    if (p.type === "BindingIdentifier" || p.type === "Identifier") {
      param.name = p.name;
    }
    // FormalParameter wrapping a BindingPattern / pattern
    else if (p.pattern) {
      if (p.pattern.kind === "BindingIdentifier") {
        param.name = p.pattern.name ?? "unknown";
      } else {
        param.name = `[${p.pattern.kind ?? p.pattern.type}]`;
      }
      // TypeAnnotation
      if (p.pattern?.typeAnnotation?.typeAnnotation) {
        param.type = serializeType(p.pattern.typeAnnotation.typeAnnotation);
      }
    }
    // AssignmentPattern (default values)
    else if (p.type === "AssignmentPattern") {
      param.name = ident(p.left);
      if (p.right) param.defaultValue = serializeExpr(p.right);
    }
    // RestElement
    else if (p.type === "RestElement") {
      param.name = `...${ident(p.argument)}`;
    }

    return param;
  });
};

/** 
 * Serialize a TS type annotation node to a string 
 **/
export const serializeType = (typeNode: any): string | undefined => {
  if (!typeNode) return undefined;
  switch (typeNode.type) {
    case "TSStringKeyword":
      return "string";
    case "TSNumberKeyword":
      return "number";
    case "TSBooleanKeyword":
      return "boolean";
    case "TSVoidKeyword":
      return "void";
    case "TSAnyKeyword":
      return "any";
    case "TSNeverKeyword":
      return "never";
    case "TSUnknownKeyword":
      return "unknown";
    case "TSNullKeyword":
      return "null";
    case "TSUndefinedKeyword":
      return "undefined";
    case "TSTypeReference":
      return ident(typeNode.typeName) + (typeNode.typeParameters ? serializeTypeParams(typeNode.typeParameters) : "");
    case "TSArrayType":
      return `${serializeType(typeNode.elementType)}[]`;
    case "TSUnionType":
      return typeNode.types?.map(serializeType).join(" | ") ?? "unknown";
    case "TSIntersectionType":
      return typeNode.types?.map(serializeType).join(" & ") ?? "unknown";
    case "TSPromiseType":
    case "TSTypeQuery":
      return "Promise<unknown>";
    case "TSLiteralType":
      return String(typeNode.literal?.value ?? "literal");
    case "TSFunctionType":
      return "Function";
    case "TSObjectKeyword":
      return "object";
    case "TSTupleType":
      return `[${typeNode.elementTypes?.map(serializeType).join(", ") ?? ""}]`;
    default:
      return typeNode.type?.replace(/^TS/, "") ?? "unknown";
  }
};

export const serializeTypeParams = (params: any): string => {
  if (!params?.params?.length) return "";
  return `<${params.params.map(serializeType).join(", ")}>`;
};

export const serializeExpr = (node: any): string => {
  if (!node) return "";
  if (node.type === "StringLiteral") return `"${node.value}"`;
  if (node.type === "NumericLiteral") return String(node.value);
  if (node.type === "BooleanLiteral") return String(node.value);
  if (node.type === "NullLiteral") return "null";
  if (node.type === "Identifier") return node.name;
  return "";
};
