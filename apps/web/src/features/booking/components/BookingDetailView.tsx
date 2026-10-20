import { CalendarX, ShieldAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ApiError } from '../../../shared/api';
import { useMe } from '../../auth';
import { Button, EmptyState } from '../../../shared/ui';
import { Skeleton } from '../../../shared/ui/Skeleton';
import { useBooking } from '../api/bookings-hooks';
import { BookingActions } from './BookingActions';
import {
  BookingContacts,
  BookingHeading,
  BookingMessages,
  BookingPrice,
  CreatedNotice,
  bookingRoleOf,
} from './BookingDetailSections';
import { BookingTimeline } from './BookingTimeline';

function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-10 w-2/3" />
      <Skeleton className="h-32 w-full rounded-lg" />
      <Skeleton className="h-48 w-full rounded-lg" />
    </div>
  );
}

function DetailError({ notFound, onRetry }: { notFound: boolean; onRetry: () => void }) {
  const { t } = useTranslation();

  return (
    <EmptyState
      titleAs="h1"
      icon={
        notFound ? (
          <CalendarX className="size-6" aria-hidden="true" />
        ) : (
          <ShieldAlert className="size-6" aria-hidden="true" />
        )
      }
      title={notFound ? t('booking.detail.notFoundTitle') : t('booking.detail.loadErrorTitle')}
      description={notFound ? t('booking.detail.notFoundBody') : t('booking.detail.loadErrorBody')}
      action={
        notFound ? (
          <Link to="/trips" className="text-small font-semibold text-primary hover:underline">
            {t('booking.detail.backTrips')}
          </Link>
        ) : (
          <Button variant="secondary" onClick={onRetry}>
            {t('common.retry')}
          </Button>
        )
      }
    />
  );
}

export function BookingDetailView() {
  const { id } = useParams<{ id: string }>();
  const [params] = useSearchParams();
  const { data: user } = useMe();
  const query = useBooking(id);

  if (query.isPending) return <DetailSkeleton />;

  if (query.isError) {
    return (
      <DetailError
        notFound={query.error instanceof ApiError && query.error.status === 404}
        onRetry={() => void query.refetch()}
      />
    );
  }

  const booking = query.data;
  const role = bookingRoleOf(booking, user?.id);

  return (
    <article className="flex flex-col gap-6">
      <BookingHeading booking={booking} role={role} />

      {params.get('created') ? <CreatedNotice booking={booking} role={role} /> : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <div className="flex flex-col gap-6">
          <BookingMessages booking={booking} />
          <BookingContacts booking={booking} role={role} />
          <BookingTimeline events={booking.events} />
        </div>

        <aside className="flex flex-col gap-4">
          <BookingPrice booking={booking} />
          <div className="rounded-lg border border-border bg-surface p-4">
            <BookingActions booking={booking} role={role} />
          </div>
        </aside>
      </div>
    </article>
  );
}
