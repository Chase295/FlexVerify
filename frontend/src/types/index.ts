// User & Auth Types
export interface User {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  is_active: boolean;
  is_superadmin: boolean;
  roles: Role[];
  visible_fields?: string[] | null;
  editable_fields?: string[] | null;
}

// Scanner Configuration Types
export interface ScannerTextSearchConfig {
  enabled_fields: string[];
  default_fields: string[];
  max_results: number;
}

export interface ScannerFaceConfig {
  show_confidence: boolean;
  min_confidence: number;
}

// Scanner result display configuration
export interface ScannerResultDisplayConfig {
  show_photo: boolean;
  show_compliance_status: boolean;
  visible_fields: string[];  // Field IDs or special keys like 'first_name', 'email', etc.
}

// DISABLED: QR/Barcode modes temporarily disabled
// Original types were: ('face' | 'qr' | 'barcode' | 'text')[]
export interface ScannerConfig {
  enabled_modes: ('face' | 'text')[];
  default_mode: 'face' | 'text';
  text_search: ScannerTextSearchConfig;
  face_recognition: ScannerFaceConfig;
  result_display?: ScannerResultDisplayConfig;
}

export interface Role {
  id: string;
  name: string;
  description?: string;
  permissions: Record<string, boolean>;
  visible_fields?: string[];
  editable_fields?: string[];
  scanner_config?: ScannerConfig;
  created_at?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}

// Person Types
export interface Person {
  id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  email?: string;
  phone?: string;
  personnel_number?: string;
  qr_code?: string;
  barcode?: string;
  field_data: Record<string, any>;
  has_photo: boolean;
  has_face_vectors: boolean;
  is_active: boolean;
  compliance_status: 'pending' | 'valid' | 'warning' | 'expired';
  created_at: string;
  updated_at: string;
}

export interface PersonCreate {
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  personnel_number?: string;
  qr_code?: string;
  barcode?: string;
  field_data?: Record<string, any>;
}

// Field Definition Types
export interface FieldDefinition {
  id: string;
  name: string;
  label: string;
  description?: string;
  field_type: FieldType;
  category?: string;
  field_order: number;
  is_required: boolean;
  is_searchable: boolean;
  is_unique: boolean;
  is_system: boolean;  // System fields cannot be deleted
  configuration: Record<string, any>;
  validation_rules: Record<string, any>;
  dependencies: Record<string, any>;
  visible_to_roles: string[];
  editable_by_roles: string[];
  created_at: string;
  updated_at: string;
}

// DISABLED: QR/Barcode field types temporarily disabled
// | 'qr_code'
// | 'barcode';
export type FieldType =
  | 'text'
  | 'textarea'
  | 'email'
  | 'number'
  | 'date'
  | 'date_expiry'
  | 'checkbox'
  | 'dropdown'
  | 'photo'
  | 'document';

// Recognition Types
export interface FaceSearchResponse {
  match: boolean;
  person?: PersonMatch;
  confidence?: number;
  best_distance?: number;
  vector_types_tested: number;
  compliance_status?: ComplianceStatus;
  reason?: string;
}

export interface PersonMatch {
  id: string;
  first_name?: string;
  last_name?: string;
  full_name: string;
  email?: string;
  phone?: string;
  personnel_number?: string;
  photo_url?: string;
  field_data: Record<string, any>;
  visible_field_labels?: Record<string, string>;  // Labels for visible fields
}

export interface ComplianceStatus {
  status: 'pending' | 'valid' | 'warning' | 'expired';
  is_compliant: boolean;
  warnings: ComplianceIssue[];
  errors: ComplianceIssue[];
}

export interface ComplianceIssue {
  field_id: string;
  field_name: string;
  field_label: string;
  message: string;
  days_until_expiry?: number;
  expiry_date?: string;
}

// Compliance Rule Types
export type ComplianceCheckType =
  | 'date_not_expired'
  | 'date_before'
  | 'date_after'
  | 'checkbox_is_true'
  | 'checkbox_is_false'
  | 'value_equals'
  | 'value_not_equals'
  | 'number_greater_than'
  | 'number_less_than'
  | 'not_empty';

export interface ComplianceRule {
  check_type: ComplianceCheckType;
  compare_to?: 'today' | 'fixed_date';
  compare_value?: string | number;
  warning_days?: number;
  error_message?: string;
}

// API Response Types
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface ApiError {
  detail: string;
}

// Person Field Types for permissions configuration
export interface PersonField {
  id: string;
  name: string;
  label: string;
  type: 'standard' | 'dynamic';
  field_type?: string;
  category?: string;
}

export interface AllPersonFieldsResponse {
  standard_fields: PersonField[];
  dynamic_fields: PersonField[];
}
