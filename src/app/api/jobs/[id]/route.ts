import { getJob } from '@/server/jobs/job-repository';
import { apiError, NotFoundError } from '@/server/protocol/http';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const job = await getJob(id);
    if (!job) throw new NotFoundError('Job not found.');
    return Response.json(job, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return apiError(error);
  }
}

