import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@repo/ui/button';

export default function Header() {
  return (
    <header className="relative z-50 px-4 py-2">
      <nav className="max-w-4xl mx-auto flex items-center justify-between">
        <Link href="/" className="flex items-center">
          <Image src="/logo.png" alt="Envie" width={20} height={20} className="text-black" />
          <span className="text-base font-bold text-logo bg-clip-text ml-[1px] italic">
            nvie
          </span>
        </Link>
        <div className="hidden md:flex items-center space-x-4">
          <a href="https://github.com/ilmari-h/envie" className="text-neutral-400 hover:text-accent-400 transition-colors flex items-center space-x-1 text-xs group">
            <Image src="/github.svg" alt="GitHub" width={16} height={16} className="brightness-0 invert mr-1 opacity-60 group-hover:opacity-100 transition-opacity" style={{filter: 'brightness(0) invert(1) sepia(1) saturate(0) hue-rotate(0deg)'}} />
            <span>Star on GitHub</span>
          </a>
          <Link href="https://web.envie.cloud/new-user">
            <Button variant="accent">Sign Up</Button>
          </Link>
        </div>
      </nav>
    </header>
  );
}
