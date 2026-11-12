import { createBrowserRouter } from 'react-router'
import { AppLayout } from '@/components/AppLayout'
import { InventoryPage } from '@/pages/InventoryPage'
import { LotPage } from '@/pages/LotPage'
import { MyBidsPage } from '@/pages/MyBidsPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { WatchlistPage } from '@/pages/WatchlistPage'

// T5: routes. Search, filters and sort live in the query string on "/".
export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <InventoryPage /> },
      { path: 'lot/:lot', element: <LotPage /> },
      { path: 'my-bids', element: <MyBidsPage /> },
      { path: 'watchlist', element: <WatchlistPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
