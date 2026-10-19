import { House } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { ListingEditor, useMyListings } from '../../features/listings';
import { Button, EmptyState, Skeleton } from '../../shared/ui';

function EditorSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-hidden="true">
      <Skeleton className="h-8 w-1/2" />
      <Skeleton className="h-64 w-full rounded-lg" />
      <Skeleton className="h-64 w-full rounded-lg" />
    </div>
  );
}

export function ListingEditorPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id = '' } = useParams();
  const { data, isPending, isError, refetch } = useMyListings();

  if (isPending) return <EditorSkeleton />;

  if (isError) {
    return (
      <EmptyState
        icon={<House className="size-6" aria-hidden="true" />}
        titleAs="h1"
        title={t('listings.loadErrorTitle')}
        description={t('listings.loadErrorBody')}
        action={
          <Button variant="secondary" onClick={() => void refetch()}>
            {t('common.retry')}
          </Button>
        }
      />
    );
  }

  const listing = data?.find((item) => item.id === id);

  if (!listing) {
    return (
      <EmptyState
        icon={<House className="size-6" aria-hidden="true" />}
        titleAs="h1"
        title={t('listings.editor.notFoundTitle')}
        description={t('listings.editor.notFoundBody')}
        action={
          <Button onClick={() => navigate('/host/listings')}>{t('listings.editor.back')}</Button>
        }
      />
    );
  }

  return <ListingEditor listing={listing} />;
}
