export const NAVY = '#1D1349'
export const LIME = '#D8E583'
export const SKY = '#A7D3F0'
export const PINK = '#F59196'
export const CREAM = '#FAF4EC'
export const BLUE = '#0030EF'

export type CatId = 'communaute' | 'standard' | 'premium' | 'vip'

export interface Category {
  id: CatId
  name: string
  who: string
  price: number
  short: string
  main: string // fond partie principale
  stub: string // fond souche
  onMain: string // texte sur la partie principale
  onStub: string // texte sur la souche
  quota: number
  left: number // places restantes (démo)
  perks: string[]
}

// Templates corrigés selon la charte (section 9.4 du cahier des charges)
export const CATEGORIES: Category[] = [
  {
    id: 'communaute', name: 'Communauté', who: 'Étudiantes et membres de la communauté', price: 15000, short: '15K',
    main: PINK, stub: NAVY, onMain: NAVY, onStub: '#FFFFFF', quota: 120, left: 74,
    perks: ['Accès à la soirée', 'Place en salle', 'Justificatif demandé (carte étudiante ou profil)'],
  },
  {
    id: 'standard', name: 'Standard', who: 'Grand public', price: 20000, short: '20K',
    main: SKY, stub: NAVY, onMain: NAVY, onStub: '#FFFFFF', quota: 200, left: 131,
    perks: ['Accès à la soirée', 'Place en salle', 'Billet électronique'],
  },
  {
    id: 'premium', name: 'Premium', who: 'Grand public, avantages renforcés', price: 30000, short: '30K',
    main: NAVY, stub: LIME, onMain: '#FFFFFF', onStub: NAVY, quota: 80, left: 36,
    perks: ['Placement privilégié', 'Avantages à confirmer par l’équipe', 'Billet électronique'],
  },
  {
    id: 'vip', name: 'VIP', who: 'Invités et partenaires privilégiés', price: 50000, short: '50K',
    main: LIME, stub: NAVY, onMain: NAVY, onStub: '#FFFFFF', quota: 40, left: 12,
    perks: ['Placement VIP', 'Cocktail et rencontres (à confirmer)', 'Billet électronique'],
  },
]

export const byId = (id: CatId) => CATEGORIES.find((c) => c.id === id)!

export const fcfa = (n: number) => n.toLocaleString('fr-FR').replace(/ /g, ' ') + ' FCFA'

export const EVENT = {
  title: 'Le WTM Gala',
  date: '12 Déc 2026',
  dateLong: 'Samedi 12 décembre 2026',
  place: 'Lieu à confirmer',
  doors: 'Heure des portes à confirmer',
}
