import { ApiParameter, ParameterLocation, ParameterType } from '../models/parameter';

export interface ParameterSuggestion {
  value: unknown;
  placeholder: string;
  type: ParameterType;
  isSensitive?: boolean;
}

const SAMPLE_IDS = ['123', '456', '789', '101', '202'];

/**
 * Deterministically suggests safe, realistic example values and placeholders
 * based on the parameter's semantic name, location, and inferred type.
 *
 * Fully offline, deterministic, and secure. Never reads or leaks environment variables.
 *
 * @param name Parameter name (e.g. "email", "password", "userId", "page")
 * @param location 'path' | 'query' | 'body'
 * @param inferredType Optional type hint ('string', 'number', 'boolean', 'object', 'array')
 * @param idCounter Optional sequence counter to assign unique IDs to multiple id parameters
 */
export function suggestParameterValue(
  name: string,
  location: ParameterLocation,
  inferredType?: string,
  idCounter = 0
): ParameterSuggestion {
  const cleanName = (name || '').trim();
  const lower = cleanName.toLowerCase();

  // 1. Password / Secret / Auth credential (strictly masked, never read from env)
  if (
    lower === 'password' ||
    lower === 'pass' ||
    lower.endsWith('password') ||
    lower.endsWith('_password') ||
    lower.startsWith('password_') ||
    lower.includes('secret')
  ) {
    return {
      value: 'password',
      placeholder: '••••••••',
      type: 'string',
      isSensitive: true,
    };
  }

  // 2. Email
  if (lower === 'email' || lower === 'emailaddress' || lower.endsWith('email') || lower.endsWith('_email')) {
    return {
      value: 'user@example.com',
      placeholder: 'user@example.com',
      type: 'string',
    };
  }

  // 3. Identifiers / IDs
  if (
    lower === 'id' ||
    lower.endsWith('id') ||
    lower.endsWith('_id') ||
    lower.endsWith('uuid')
  ) {
    const sampleId = SAMPLE_IDS[idCounter % SAMPLE_IDS.length];
    if (location === 'body' && inferredType === 'number') {
      const numId = parseInt(sampleId, 10);
      return {
        value: numId,
        placeholder: sampleId,
        type: 'number',
      };
    }
    return {
      value: sampleId,
      placeholder: sampleId,
      type: 'string',
    };
  }

  // 4. Names
  if (lower === 'firstname' || lower === 'first_name') {
    return { value: 'John', placeholder: 'John', type: 'string' };
  }
  if (lower === 'lastname' || lower === 'last_name') {
    return { value: 'Doe', placeholder: 'Doe', type: 'string' };
  }
  if (lower === 'username' || lower === 'user_name') {
    return { value: 'johndoe', placeholder: 'johndoe', type: 'string' };
  }
  if (lower === 'name' || lower === 'fullname' || lower === 'full_name') {
    return { value: 'John Doe', placeholder: 'John Doe', type: 'string' };
  }

  // 5. Phone numbers
  if (lower === 'phone' || lower === 'phonenumber' || lower === 'phone_number' || lower === 'mobile') {
    return { value: '+1-555-0199', placeholder: '+1-555-0199', type: 'string' };
  }

  // 6. Pagination & numeric metrics
  if (lower === 'page') {
    return { value: 1, placeholder: '1', type: 'number' };
  }
  if (lower === 'limit' || lower === 'pagesize' || lower === 'page_size' || lower === 'perpage' || lower === 'per_page') {
    return { value: 20, placeholder: '20', type: 'number' };
  }
  if (lower === 'offset' || lower === 'skip') {
    return { value: 0, placeholder: '0', type: 'number' };
  }
  if (lower === 'count' || lower === 'total') {
    const val = location === 'query' ? '10' : 10;
    return { value: val, placeholder: '10', type: 'number' };
  }
  if (lower === 'age') {
    const val = location === 'query' ? '25' : 25;
    return { value: val, placeholder: '25', type: 'number' };
  }
  if (lower === 'price' || lower === 'amount' || lower === 'cost') {
    const val = location === 'query' ? '99.99' : 99.99;
    return { value: val, placeholder: '99.99', type: 'number' };
  }

  // 7. Status / State
  if (lower === 'status') {
    return { value: 'active', placeholder: 'active', type: 'string' };
  }
  if (lower === 'role') {
    return { value: 'admin', placeholder: 'admin', type: 'string' };
  }
  if (lower === 'type') {
    return { value: 'default', placeholder: 'default', type: 'string' };
  }
  if (lower === 'category') {
    return { value: 'general', placeholder: 'general', type: 'string' };
  }

  // 8. Booleans / Flags
  if (
    lower === 'rememberme' ||
    lower === 'remember_me' ||
    lower === 'isactive' ||
    lower === 'is_active' ||
    lower === 'enabled' ||
    lower === 'isadmin' ||
    lower === 'is_admin' ||
    lower === 'verified' ||
    lower === 'notify' ||
    lower === 'published' ||
    lower === 'completed' ||
    lower.startsWith('is_') ||
    lower.startsWith('has_') ||
    inferredType === 'boolean'
  ) {
    return { value: false, placeholder: 'false', type: 'boolean' };
  }

  // 9. Tokens / Keys / Codes
  if (
    lower === 'token' ||
    lower === 'code' ||
    lower === 'apikey' ||
    lower === 'api_key' ||
    lower === 'refreshtoken' ||
    lower === 'refresh_token' ||
    lower === 'accesstoken' ||
    lower === 'access_token' ||
    lower === 'otp'
  ) {
    return { value: 'sample_token', placeholder: 'sample_token', type: 'string' };
  }

  // 10. Dates & Timestamps
  if (
    lower === 'date' ||
    lower === 'createdat' ||
    lower === 'created_at' ||
    lower === 'updatedat' ||
    lower === 'updated_at' ||
    lower === 'startdate' ||
    lower === 'enddate' ||
    lower === 'dob' ||
    lower === 'birthdate'
  ) {
    return { value: '2026-01-01', placeholder: '2026-01-01', type: 'string' };
  }

  // 11. URLs & Images
  if (lower === 'url' || lower === 'website' || lower === 'avatar' || lower === 'image' || lower === 'icon') {
    return {
      value: 'https://example.com/avatar.png',
      placeholder: 'https://example.com/avatar.png',
      type: 'string',
    };
  }

  // 12. Text & Descriptions
  if (lower === 'title') {
    return { value: 'Sample Title', placeholder: 'Sample Title', type: 'string' };
  }
  if (lower === 'description' || lower === 'bio' || lower === 'notes' || lower === 'note') {
    return { value: 'Sample description', placeholder: 'Sample description', type: 'string' };
  }
  if (lower === 'message' || lower === 'comment' || lower === 'text') {
    return { value: 'Hello world', placeholder: 'Hello world', type: 'string' };
  }
  if (lower === 'subject') {
    return { value: 'Inquiry', placeholder: 'Inquiry', type: 'string' };
  }

  // 13. Slugs
  if (lower.includes('slug')) {
    return { value: 'sample-slug', placeholder: 'sample-slug', type: 'string' };
  }

  // 14. Fallbacks by inferred type or location
  if (inferredType === 'number') {
    return { value: 0, placeholder: '0', type: 'number' };
  }
  if (inferredType === 'boolean') {
    return { value: false, placeholder: 'false', type: 'boolean' };
  }
  if (inferredType === 'array') {
    return { value: [], placeholder: '[]', type: 'array' };
  }
  if (inferredType === 'object') {
    return { value: {}, placeholder: '{}', type: 'object' };
  }

  // Safe string fallback
  if (location === 'path') {
    return { value: '123', placeholder: '123', type: 'string' };
  }
  if (location === 'query') {
    return { value: '', placeholder: cleanName, type: 'string' };
  }

  // Body: safe placeholder string without fake naming
  return {
    value: `sample_${cleanName}`,
    placeholder: cleanName,
    type: 'string',
  };
}

/**
 * Builds a structured, properly-typed JavaScript object from an array of body parameters.
 * Automatically handles dot-separated nested keys (e.g. "user.email", "user.name") into nested objects.
 * Preserves correct primitive types (boolean, number, string, array, object).
 *
 * @param bodyParams Discovered body parameters.
 * @returns JSON-serializable object.
 */
export function buildJsonObjectFromParams(bodyParams: ApiParameter[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const param of bodyParams) {
    if (!param.name || param.location !== 'body') {
      continue;
    }

    const effectiveValue =
      param.value !== undefined
        ? param.value
        : param.defaultValue !== undefined
        ? param.defaultValue
        : suggestParameterValue(param.name, 'body', param.type).value;

    if (param.name.includes('.')) {
      // Nested property path e.g. "user.email"
      const segments = param.name.split('.').filter(Boolean);
      let current: Record<string, unknown> = result;
      for (let i = 0; i < segments.length - 1; i++) {
        const seg = segments[i];
        if (!current[seg] || typeof current[seg] !== 'object' || Array.isArray(current[seg])) {
          current[seg] = {};
        }
        current = current[seg] as Record<string, unknown>;
      }
      const lastSeg = segments[segments.length - 1];
      current[lastSeg] = effectiveValue;
    } else {
      result[param.name] = effectiveValue;
    }
  }

  return result;
}
