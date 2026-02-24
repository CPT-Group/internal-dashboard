import { sfFetchWithStoredToken } from '@/services/api/salesforceOAuth';

export const dynamic = 'force-dynamic';

interface SObjectField {
  name: string;
  type: string;
  label: string;
  createable?: boolean;
  nillable?: boolean;
  custom?: boolean;
}

interface DescribeResult {
  name: string;
  label: string;
  fields: SObjectField[];
  createable?: boolean;
}

/**
 * GET /api/sf/describe/support-channel
 * Describes Support_Channel__c and returns required + createable fields for portal mapping.
 */
export async function GET() {
  const raw = await sfFetchWithStoredToken<DescribeResult>(
    '/sobjects/Support_Channel__c/describe'
  );

  const fields = (raw.fields ?? []) as SObjectField[];
  const createableFields = fields.filter((f) => f.createable !== false);
  const requiredForCreate = createableFields.filter((f) => f.nillable === false);

  return Response.json({
    success: true,
    sobject: raw.name ?? 'Support_Channel__c',
    label: raw.label ?? 'Support Channel',
    createable: raw.createable,
    fields: createableFields.map((f) => ({
      name: f.name,
      type: f.type,
      label: f.label,
      nillable: f.nillable,
      required: f.nillable === false,
    })),
    requiredFieldApiNames: requiredForCreate.map((f) => f.name),
  });
}
