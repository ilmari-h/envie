import Image from 'next/image';
import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="border-t border-neutral-800 px-4 py-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <Link href="/" className="flex items-center mb-2 md:mb-0">
            <Image src="/logo.png" alt="Envie" width={20} height={20} className="text-black" />
            <span className="text-base font-bold text-logo bg-clip-text ml-[1px] italic">
              nvie
            </span>
          </Link>
          
          <div className="flex items-center space-x-3">
            <a href="https://github.com/ilmari-h/envie" className="text-neutral-500 hover:text-accent-400 transition-colors group">
              <Image src="/github.svg" alt="GitHub" width={16} height={16} className="transition-all group-hover:brightness-0 group-hover:invert group-hover:sepia group-hover:saturate-[3] group-hover:hue-rotate-[315deg]" style={{filter: 'brightness(0) invert(0.5)'}} />
            </a>
            <span className="text-neutral-600">•</span>
            <a href="mailto:support@envie.cloud" className="text-neutral-500 hover:text-accent-400 transition-colors text-xs">
              support@envie.cloud
            </a>
            <span className="text-neutral-600">•</span>
            <Link href="/changelog" className="text-neutral-500 hover:text-accent-400 transition-colors text-xs">
              Changelog
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
