'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Package, HandHeart, Truck, MapPin, Boxes, ScanLine, Plane } from 'lucide-react';

export const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/inventory', label: 'Inventory', icon: Package },
  { href: '/donations', label: 'Donations', icon: HandHeart },
  { href: '/distributions', label: 'Distributions', icon: Truck },
  { href: '/delivery', label: 'Delivery', icon: MapPin },
  { href: '/allocation', label: 'Allocation', icon: Boxes },
  { href: '/food-check', label: 'Food Check', icon: ScanLine },
  { href: '/drone', label: 'Drone Ops', icon: Plane },
];

export default function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="w-60 shrink-0 border-r border-stone-200 bg-white flex flex-col">
      <div className="flex items-center px-5 h-16 border-b border-stone-200">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/parsel-logo.png" alt="Parsel" className="h-7 w-auto" />
      </div>
      <nav className="p-3 space-y-1">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? 'bg-yellow-100 text-yellow-800'
                  : 'text-stone-600 hover:bg-stone-100'
              }`}
            >
              <Icon size={18} />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto p-4 text-xs text-stone-400">Building for Good 2026 · real SD need data · demo inventory</div>
    </aside>
  );
}
