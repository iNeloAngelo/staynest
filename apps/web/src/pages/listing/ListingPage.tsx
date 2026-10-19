import { useParams } from 'react-router-dom';
import { ListingDetails } from '../../features/catalog';

export function ListingPage() {
  const { id } = useParams<{ id: string }>();

  return <ListingDetails id={id ?? ''} />;
}
