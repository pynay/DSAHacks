'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Package, HandHeart, Truck, MapPin, Boxes, Plane, PackageOpen } from 'lucide-react';

export const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/inventory', label: 'Inventory', icon: Package },
  { href: '/donations', label: 'Donations', icon: HandHeart },
  { href: '/distributions', label: 'Distributions', icon: Truck },
  { href: '/delivery', label: 'Delivery', icon: MapPin },
  { href: '/allocation', label: 'Allocation', icon: Boxes },
  { href: '/drone', label: 'Drone Ops', icon: Plane },
];

export default function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-white/10 bg-[#071a2b] text-white">
      <div className="flex h-16 items-center gap-2.5 border-b border-white/10 px-5">
        <PackageOpen size={24} className="text-[#54b889]" />
        <span className="text-xl font-semibold tracking-tight">Parsel</span>
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
                  ? 'bg-[#54b889] text-[#071a2b]'
                  : 'text-slate-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Icon size={18} />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto border-t border-white/10 p-4 text-xs leading-5 text-slate-400">Building for Good 2026<br />Real SD signals · demo inventory</div>
    </aside>
  );
}
