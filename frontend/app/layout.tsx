import Providers from './providers';
import { Suspense } from 'react';
import Sidebar from '@/components/NewSidebar';

export const metadata = {
	title: 'ft_transendance_42',
	description: 'Next.js frontend for auth backend',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en">
			<body style={{margin: 0, display: 'flex', height: '100vh', overflow: 'hidden'}} >
				<Suspense fallback={null}>
					<Providers>
						<Sidebar />
						<main style={{ flex: 1, overflowY: 'auto' }}>
							{children}
						</main>
					</Providers>
				</Suspense>
			</body>
		</html>
	);
}
