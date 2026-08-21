import { redirect } from 'next/navigation';

export default function LegacyDronePage() {
  redirect('/dispatch');
}
