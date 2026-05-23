import { useRoutes } from 'react-router-dom'
import Main from './components/Main';
import BookDetails from './components/books/BookDetails';
import Statistic from './components/statistic/Statistic';
import BookRecommend from './components/recommended/BookRecommend';

export default function Router() {
  return useRoutes([
    {
      path: '/allBooks',
      element: (<Main isMyBooksOnly={false}/>)
    },    
    {
      path: '/myBooks',
      element: (<Main isMyBooksOnly={true}/>)
    },
    {
      path: '/book/details',
      element: (<BookDetails />)
    },   
    {
      path: '/statistic',
      element: (<Statistic />)
    },    
    {
      path: '/recommended',
      element: (<BookRecommend />)
    },  
    {
      path: '/',
      element: (<Main />)
    }  
 
  ])
}


