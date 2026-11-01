// Coin packs for buying with real money via Flouci. Pure data (no server imports) so
// both the client and the server can import it. 1000 millimes = 1 TND = 1000 coins.
export type CoinPack = {
  id: string
  millimes: number // price charged (Flouci amount)
  coins: number // coins credited
  label: string // price label
  bonus?: number // free coins on top, for display
}

export const COIN_PACKS: CoinPack[] = [
  { id: 'p3', millimes: 3000, coins: 3000, label: '3 دينار' },
  { id: 'p5', millimes: 5000, coins: 5500, label: '5 دينار', bonus: 500 },
  { id: 'p10', millimes: 10000, coins: 12000, label: '10 دينار', bonus: 2000 },
  { id: 'p20', millimes: 20000, coins: 26000, label: '20 دينار', bonus: 6000 },
]

export const packById = (id: string) => COIN_PACKS.find((p) => p.id === id)
