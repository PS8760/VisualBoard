import { client, apiErrorMessage } from './client';
import type { AttachmentMeta } from '../types';

interface BackendDocument {
  id: number;
  original_name: string;
  mime_type: string;
  size: number;
  created_at: string;
}

function mapDocument(raw: BackendDocument): AttachmentMeta {
  return {
    id: String(raw.id),
    name: raw.original_name,
    type: raw.mime_type,
    size: raw.size,
    uploadedAt: raw.created_at,
    url: `/documents/${raw.id}/download`,
  };
}

export async function uploadDocument(
  boardId: string,
  file: File,
  elementId?: string,
): Promise<{ ok: true; attachment: AttachmentMeta } | { ok: false; message: string }> {
  try {
    const form = new FormData();
    form.append('file', file);
    if (elementId) form.append('elementId', elementId);

    const { data } = await client.post<{ data?: BackendDocument }>(`/boards/${boardId}/documents`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });

    if (!data?.data) return { ok: false, message: 'Upload failed' };
    return { ok: true, attachment: mapDocument(data.data) };
  } catch (error) {
    return { ok: false, message: apiErrorMessage(error) };
  }
}

export async function downloadAttachment(attachment: AttachmentMeta): Promise<{ ok: boolean; message?: string }> {
  if (!attachment.url) return { ok: false, message: 'No download URL is available' };

  try {
    const { data } = await client.get<Blob>(attachment.url, { responseType: 'blob' });
    const objectUrl = URL.createObjectURL(data);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = attachment.name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
    return { ok: true };
  } catch (error) {
    return { ok: false, message: apiErrorMessage(error) };
  }
}
