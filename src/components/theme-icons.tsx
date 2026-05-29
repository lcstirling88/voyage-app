/**
 * Maps an interest-theme icon key (from INTEREST_THEMES in lib/trip-planner) to
 * a lucide icon component, so the planner client components can render an icon
 * for each theme without importing the server-only trip-planner module. Plain
 * lookup — safe in both server and client components.
 */

import {
  Mountain, Landmark, Building2, Drama, Utensils, Martini, Ticket,
  PawPrint, ShoppingBag, Flower2, Baby, Route, Sparkles,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

const MAP: Record<string, LucideIcon> = {
  mountain: Mountain,
  landmark: Landmark,
  'building-2': Building2,
  drama: Drama,
  utensils: Utensils,
  martini: Martini,
  ticket: Ticket,
  'paw-print': PawPrint,
  'shopping-bag': ShoppingBag,
  'flower-2': Flower2,
  baby: Baby,
  route: Route,
}

/** The lucide icon for a theme icon key, falling back to a generic sparkle. */
export function themeIcon(key: string): LucideIcon {
  return MAP[key] ?? Sparkles
}
