import { AdminBlogEditor } from './_components/AdminBlogEditor';

export const metadata = {
  title: 'Edit post',
  robots: { index: false, follow: false },
};

export default async function EditBlogPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AdminBlogEditor postId={id} />;
}
