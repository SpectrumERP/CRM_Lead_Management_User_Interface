export type DocFileType = 'PDF' | 'DOCX' | 'XLSX' | 'PPTX' | 'IMG';

export interface CRMDocument {
  id: string;
  name: string;
  fileType: DocFileType;
  size: string;
  relatedId: string;
  relatedType: 'lead' | 'entity';
  relatedName: string;
  uploadedBy: string;
  uploadedDate: string;
  category: string;
  /** data:image… URL for uploaded images so preview can show the original file. */
  previewUrl?: string;
}

export const DOCUMENTS: CRMDocument[] = [
  { id: 'DOC-001', name: 'TCS_NDA_Signed_2024.pdf',          fileType: 'PDF',  size: '245 KB', relatedId: 'LID-1001', relatedType: 'lead',   relatedName: 'Tata Consultancy Services',  uploadedBy: 'Priya Mehta',   uploadedDate: '05 Sep 2024', category: 'NDA' },
  { id: 'DOC-002', name: 'ERP_Suite_Brochure_v3.pdf',         fileType: 'PDF',  size: '3.2 MB', relatedId: 'LID-1001', relatedType: 'lead',   relatedName: 'Tata Consultancy Services',  uploadedBy: 'Priya Mehta',   uploadedDate: '08 Sep 2024', category: 'Brochure' },
  { id: 'DOC-003', name: 'TCS_Use_Case_Deck.pptx',            fileType: 'PPTX', size: '8.7 MB', relatedId: 'LID-1001', relatedType: 'lead',   relatedName: 'Tata Consultancy Services',  uploadedBy: 'Vikram Nair',   uploadedDate: '08 Sep 2024', category: 'Presentation' },
  { id: 'DOC-004', name: 'ROI_Analysis_TCS.xlsx',             fileType: 'XLSX', size: '420 KB', relatedId: 'LID-1001', relatedType: 'lead',   relatedName: 'Tata Consultancy Services',  uploadedBy: 'Priya Mehta',   uploadedDate: '14 Sep 2024', category: 'Analysis' },
  { id: 'DOC-005', name: 'Infosys_NDA_2024.pdf',              fileType: 'PDF',  size: '198 KB', relatedId: 'LID-1002', relatedType: 'lead',   relatedName: 'Infosys Limited',            uploadedBy: 'Anita Krishnan',uploadedDate: '12 Sep 2024', category: 'NDA' },
  { id: 'DOC-006', name: 'API_Gateway_Integration_Spec.docx', fileType: 'DOCX', size: '892 KB', relatedId: 'LID-1002', relatedType: 'lead',   relatedName: 'Infosys Limited',            uploadedBy: 'Vikram Nair',   uploadedDate: '13 Sep 2024', category: 'Technical' },
  { id: 'DOC-007', name: 'Infosys_Demo_Screenshots.pdf',      fileType: 'PDF',  size: '5.1 MB', relatedId: 'LID-1002', relatedType: 'lead',   relatedName: 'Infosys Limited',            uploadedBy: 'Priya Mehta',   uploadedDate: '14 Sep 2024', category: 'Presentation' },
  { id: 'DOC-008', name: 'Jio_Proposal_Draft_v2.pdf',         fileType: 'PDF',  size: '2.4 MB', relatedId: 'LID-1006', relatedType: 'lead',   relatedName: 'Reliance Jio Infocomm',     uploadedBy: 'Meena Iyer',    uploadedDate: '17 Sep 2024', category: 'Proposal' },
  { id: 'DOC-009', name: 'BSS_OSS_Architecture.pptx',         fileType: 'PPTX', size: '6.8 MB', relatedId: 'LID-1006', relatedType: 'lead',   relatedName: 'Reliance Jio Infocomm',     uploadedBy: 'Vikram Nair',   uploadedDate: '18 Sep 2024', category: 'Technical' },
  { id: 'DOC-010', name: 'HDFC_Compliance_Checklist.xlsx',    fileType: 'XLSX', size: '340 KB', relatedId: 'LID-1012', relatedType: 'lead',   relatedName: 'HDFC Bank',                  uploadedBy: 'Meena Iyer',    uploadedDate: '09 Sep 2024', category: 'Compliance' },
  { id: 'DOC-011', name: 'HDFC_Core_Banking_Proposal.pdf',    fileType: 'PDF',  size: '4.2 MB', relatedId: 'LID-1012', relatedType: 'lead',   relatedName: 'HDFC Bank',                  uploadedBy: 'Priya Mehta',   uploadedDate: '09 Sep 2024', category: 'Proposal' },
  { id: 'DOC-012', name: 'SunPharma_QMS_RFP_Response.docx',   fileType: 'DOCX', size: '1.8 MB', relatedId: 'LID-1009', relatedType: 'lead',   relatedName: 'Sun Pharmaceutical',         uploadedBy: 'Arjun Patel',   uploadedDate: '16 Sep 2024', category: 'Proposal' },
  { id: 'DOC-013', name: 'FDA_21CFR_Compliance_Matrix.xlsx',  fileType: 'XLSX', size: '560 KB', relatedId: 'LID-1009', relatedType: 'lead',   relatedName: 'Sun Pharmaceutical',         uploadedBy: 'Priya Mehta',   uploadedDate: '16 Sep 2024', category: 'Compliance' },
  { id: 'DOC-014', name: 'Mahindra_NDA_Signed.pdf',           fileType: 'PDF',  size: '220 KB', relatedId: 'BE-006',   relatedType: 'entity', relatedName: 'Mahindra & Mahindra Ltd.',   uploadedBy: 'Meena Iyer',    uploadedDate: '04 Sep 2024', category: 'NDA' },
  { id: 'DOC-015', name: 'LT_Oracle_Integration_Brief.pdf',   fileType: 'PDF',  size: '1.1 MB', relatedId: 'BE-007',   relatedType: 'entity', relatedName: 'Larsen & Toubro Ltd.',       uploadedBy: 'Vikram Nair',   uploadedDate: '31 Aug 2024', category: 'Technical' },
];

export function docTypeMeta(fileType: string) {
  const m: Record<string, { bg: string; color: string; label: string }> = {
    PDF:  { bg: '#fff0f0', color: '#c41e1e', label: 'PDF' },
    DOCX: { bg: '#eef2fb', color: '#2955a3', label: 'DOCX' },
    XLSX: { bg: '#edfbf1', color: '#1a8040', label: 'XLSX' },
    PPTX: { bg: '#fff7ed', color: '#ea580c', label: 'PPTX' },
    IMG:  { bg: '#f5f3ff', color: '#7c3aed', label: 'IMG' },
  };
  return m[fileType] ?? { bg: '#f0f4fb', color: '#4a5d82', label: fileType };
}

const IMAGE_NAME = /\.(png|jpe?g|gif|webp|bmp|svg)$/i
const MAX_PREVIEW_CHARS = 2_000_000

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function isImageDocument(fileType: string, name: string) {
  return fileType === 'IMG' || IMAGE_NAME.test(name)
}

export function sanitizePreviewUrl(value?: string): string | undefined {
  if (!value?.startsWith('data:image/')) return undefined
  if (value.length > MAX_PREVIEW_CHARS) return undefined
  return value
}

export function readImagePreview(file: File): Promise<string | undefined> {
  const looksLikeImage = file.type.startsWith('image/') || IMAGE_NAME.test(file.name)
  if (!looksLikeImage) return Promise.resolve(undefined)
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => {
      resolve(sanitizePreviewUrl(typeof reader.result === 'string' ? reader.result : undefined))
    }
    reader.onerror = () => resolve(undefined)
    reader.readAsDataURL(file)
  })
}
