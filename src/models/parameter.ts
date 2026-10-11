/**
 * Normalized parameter data models for API Route Explorer.
 * Serves as the single source of truth across Route Analysis,
 * Parameter Extraction, and the Test API HTTP Client.
 */

export type ParameterLocation = 'path' | 'query' | 'body';

export type ParameterType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'object'
  | 'array'
  | 'unknown';

export interface ApiParameter {
  /**
   * Actual parameter name extracted from code or route declaration.
   * e.g. "userId", "email", "password", "page", "status"
   */
  name: string;

  /**
   * Location of the parameter: path (/users/:userId), query (?page=1), or body ({ email }).
   */
  location: ParameterLocation;

  /**
   * Whether the parameter is strictly required by the endpoint.
   */
  required: boolean;

  /**
   * Inferred primitive or structural type: string, number, boolean, object, array.
   */
  type?: ParameterType | string;

  /**
   * Human-friendly placeholder value displayed in UI inputs.
   */
  placeholder?: string;

  /**
   * Suggested deterministic default value (e.g. "user@example.com", 123, false).
   */
  value?: unknown;

  /**
   * Default value extracted from code or assigned by suggester.
   */
  defaultValue?: unknown;

  /**
   * Whether the parameter is optional (e.g. :id?, optional schema property).
   */
  isOptional?: boolean;

  /**
   * Whether this field contains sensitive data (e.g. password, token) to be masked.
   */
  isSensitive?: boolean;

  /**
   * Optional descriptive context or schema details.
   */
  description?: string;
}
