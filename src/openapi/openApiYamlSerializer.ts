import { OpenApiDocument } from './openApiTypes';

/**
 * Priority ordering for top-level OpenAPI keys.
 */
const TOP_LEVEL_KEY_ORDER: Record<string, number> = {
  openapi: 1,
  info: 2,
  servers: 3,
  tags: 4,
  paths: 5,
  components: 6,
  'x-api-route-explorer': 7,
};

/**
 * Priority ordering for OpenAPI Operation sub-keys.
 */
const OPERATION_KEY_ORDER: Record<string, number> = {
  operationId: 1,
  summary: 2,
  description: 3,
  tags: 4,
  parameters: 5,
  requestBody: 6,
  responses: 7,
  deprecated: 8,
  'x-api-route-explorer': 9,
};

/**
 * Priority ordering for OpenAPI Parameter sub-keys.
 */
const PARAMETER_KEY_ORDER: Record<string, number> = {
  name: 1,
  in: 2,
  description: 3,
  required: 4,
  schema: 5,
  example: 6,
};

/**
 * Checks if a string must be quoted in YAML.
 */
function needsQuoting(str: string): boolean {
  if (str === '') {
    return true;
  }

  // Boolean or null literals in YAML
  const reservedLiterals = new Set([
    'true',
    'false',
    'yes',
    'no',
    'y',
    'n',
    'null',
    '~',
    'on',
    'off',
  ]);
  if (reservedLiterals.has(str.toLowerCase())) {
    return true;
  }

  // Number-like string (including HTTP status codes like "200", "404")
  if (/^[-+]?(\d+(\.\d*)?|\.\d+)([eE][-+]?\d+)?$/.test(str) || /^0[xX][0-9a-fA-F]+$/.test(str)) {
    return true;
  }

  // Contains characters that require quotes or have special YAML meaning
  if (/[:#{}\[\],&*?|<>=!%@\\`"'\n\r\t]/.test(str)) {
    return true;
  }

  // Starts or ends with whitespace
  if (str.startsWith(' ') || str.endsWith(' ')) {
    return true;
  }

  // Starts with characters with special YAML meaning at line start
  if (/^[-?:]/.test(str)) {
    return true;
  }

  return false;
}

/**
 * Quotes a string safely for YAML output.
 */
function quoteYamlString(str: string): string {
  // Use JSON.stringify for robust escaping, handles \n, \t, quotes, backslashes
  return JSON.stringify(str);
}

/**
 * Recursively serializes a JavaScript value to YAML.
 */
function serializeValue(
  value: unknown,
  indent: number,
  customKeyOrder?: Record<string, number>
): string {
  if (value === null || value === undefined) {
    return 'null';
  }

  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value.toString() : 'null';
  }

  if (typeof value === 'string') {
    return needsQuoting(value) ? quoteYamlString(value) : value;
  }

  const spaces = ' '.repeat(indent);

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return '[]';
    }

    const lines: string[] = [];
    for (const item of value) {
      if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
        // Object item in array: output `- firstKey: value`
        const objLines = serializeObjectLines(item as Record<string, unknown>, indent + 2);
        if (objLines.length > 0) {
          lines.push(`${spaces}- ${objLines[0].trim()}`);
          for (let i = 1; i < objLines.length; i++) {
            lines.push(objLines[i]);
          }
        } else {
          lines.push(`${spaces}- {}`);
        }
      } else {
        const serializedItem = serializeValue(item, indent + 2);
        lines.push(`${spaces}- ${serializedItem}`);
      }
    }
    return lines.join('\n');
  }

  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj);
    if (keys.length === 0) {
      return '{}';
    }

    const lines = serializeObjectLines(obj, indent, customKeyOrder);
    return lines.join('\n');
  }

  return String(value);
}

/**
 * Serializes the key-value pairs of an object into an array of YAML formatted lines.
 */
function serializeObjectLines(
  obj: Record<string, unknown>,
  indent: number,
  customKeyOrder?: Record<string, number>
): string[] {
  const spaces = ' '.repeat(indent);
  const keys = Object.keys(obj).sort((a, b) => {
    if (customKeyOrder) {
      const orderA = customKeyOrder[a] ?? 1000;
      const orderB = customKeyOrder[b] ?? 1000;
      if (orderA !== orderB) {
        return orderA - orderB;
      }
    }
    return a.localeCompare(b);
  });

  const lines: string[] = [];

  for (const key of keys) {
    const val = obj[key];
    if (val === undefined) {
      continue;
    }

    const formattedKey = needsQuoting(key) ? quoteYamlString(key) : key;

    if (val === null) {
      lines.push(`${spaces}${formattedKey}: null`);
    } else if (typeof val === 'object') {
      if (Array.isArray(val)) {
        if (val.length === 0) {
          lines.push(`${spaces}${formattedKey}: []`);
        } else {
          lines.push(`${spaces}${formattedKey}:`);
          lines.push(serializeValue(val, indent + 2));
        }
      } else {
        const subObj = val as Record<string, unknown>;
        if (Object.keys(subObj).length === 0) {
          lines.push(`${spaces}${formattedKey}: {}`);
        } else {
          lines.push(`${spaces}${formattedKey}:`);
          let nextKeyOrder: Record<string, number> | undefined;
          if (
            key === 'get' ||
            key === 'post' ||
            key === 'put' ||
            key === 'delete' ||
            key === 'patch' ||
            key === 'head' ||
            key === 'options'
          ) {
            nextKeyOrder = OPERATION_KEY_ORDER;
          } else if (key === 'parameters') {
            nextKeyOrder = PARAMETER_KEY_ORDER;
          }
          lines.push(serializeValue(subObj, indent + 2, nextKeyOrder));
        }
      }
    } else {
      const formattedVal = serializeValue(val, indent + 2);
      lines.push(`${spaces}${formattedKey}: ${formattedVal}`);
    }
  }

  return lines;
}

/**
 * Serializes an OpenAPI 3.0.3 document into standard, deterministic YAML.
 *
 * @param document OpenAPI document object.
 * @returns Deterministic, human-readable YAML string.
 */
export function serializeOpenApiToYaml(document: OpenApiDocument): string {
  const lines = serializeObjectLines(
    document as unknown as Record<string, unknown>,
    0,
    TOP_LEVEL_KEY_ORDER
  );
  return lines.join('\n') + '\n';
}

/**
 * Serializes an OpenAPI 3.0.3 document into formatted, deterministic JSON.
 *
 * @param document OpenAPI document object.
 * @returns Deterministic JSON string with 2-space indentation.
 */
export function serializeOpenApiToJson(document: OpenApiDocument): string {
  return JSON.stringify(document, null, 2) + '\n';
}
