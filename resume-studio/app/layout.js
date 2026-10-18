import './globals.css';
import Nav from '../components/Nav.js';

export const metadata = { title: 'Resume Studio', description: 'Your career data, reusable. Tailored resumes in a few clicks.' };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Nav />
        {children}
      </body>
    </html>
  );
}
