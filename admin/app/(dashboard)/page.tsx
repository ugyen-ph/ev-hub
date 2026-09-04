import { redirect } from 'next/navigation';

// `/` is just an alias for the Stations dashboard.
export default function Home() {
  redirect('/stations');
}
