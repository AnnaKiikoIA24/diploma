import React from 'react';
import { useEffect, useState, useRef, useContext } from 'react';
import { Card, Chart, DataTable, Column, Panel, Toast } from 'primereact';
import {useNavigate} from "react-router-dom";
import { AppContext } from '../context/AppContext';
import './Statistic.css';
import { getStatistic } from '../../utils/statistic';

export default function Statistic() {
  const navigate = useNavigate();  
  const { user } = useContext(AppContext);  
  // ознака процеса завантаження даних
  const [ loading, setLoading ] = useState(false);  
  const toast = useRef(null);

  const [totalBooks, setTotalBooks] = useState(0);
  const [totalUsers, setTotalUsers] = useState(0);  
  const [activeUsers, setActiveUsers] = useState(0); 

  const [topBooks, setTopBooks] = useState([]);
  const [topUsers, setTopUsers] = useState([]);
  const [topAuthors, setTopAuthors] = useState([]);

  const [genres, setGenres] = useState([]);
  const [genresBooks, setGenresBooks] = useState([]);
  const [genresColors, setGenresColors] = useState([]);

  const [months, setMonths] = useState([]);
  const [readActivityStarted, setReadActivityStarted] = useState([]);
  const [readActivityFinished, setReadActivityFinished] = useState([]);

  useEffect(() => { 
    const loadData = async() => {
      setLoading(true);   
      try {

        const response = await getStatistic(toast);
        if (response) {
          setTotalBooks(response.totalBooks);
          setTotalUsers(response.totalUsers);
          setActiveUsers(response.activeUsers);

          setTopBooks(response.topBooks);
          setTopUsers(response.topUsers);
          setTopAuthors(response.topAuthors);

          setGenres(response.booksByGenre.map(g => g.genreName));
          setGenresColors(response.booksByGenre.map(g => g.chartColor));
          setGenresBooks(response.booksByGenre.map(g => g.cntBooks));

          setMonths(response.readActivity.map(r => r.month));
          setReadActivityStarted(response.readActivity.map(r => r.cntStarted));
          setReadActivityFinished(response.readActivity.map(r => r.cntFinished));
        }
      } 
      finally {
        setLoading(false); // знімаємо ознаку після завершення завантаження
      }
    }  

    if ((!user || !user.userId) && localStorage.getItem('jwtToken') !== "") {
      localStorage.removeItem("jwtToken");
      document.cookie = `refresh-token=; Max-Age=-1; Path=/; `;     
      if (window.location.pathname.startsWith("/statistic"))  
        navigate('/');
    }
    else {
      loadData();
    }
  }, [user?.userId])

  // Розподіл за жанрами
  const booksByGenre = {
    labels: genres,
    datasets: [
      {
        data: genresBooks,
        backgroundColor: genresColors 
      }
    ]
  };

  const genreOptions = {
    plugins: {
      legend: {
        display: true,
        position: 'left',   // легенда зліва
        labels: {
          boxWidth: 20,     // розмір кольорового квадратика
        }
      }
    }
  };  

  // Активність читання
  const readingActivity = {
    labels: months,
    datasets: [
      {
        label: 'Розпочато книг',
        data: readActivityStarted,
        //fill: false,
        //borderColor: '#42A5F5',
        backgroundColor: '#42A5F5',
        //tension: 1.0
      },
      {
        label: 'Завершено книг',
        data: readActivityFinished,
        //fill: false,
        //borderColor: '#66BB6A',
        backgroundColor: '#66BB6A',
        //tension: 1.0
      }
    ]
  };

  return (<>      
    <Toast ref={toast} /> 
    <div className="grid nogutter flex flex-column">
      {/* Загальна статистика */}
      <div className="grid">
        <div className="col-12 md:col-4">
          <Card className="card-pastel-blue" title="Загалом книг" subTitle="У бібліотеці">
            <h2 className='my-0'><i className='pi pi-book' style={{ fontSize: '1.5rem' }} /> {totalBooks}</h2>
          </Card>
        </div>
        <div className="col-12 md:col-4">
          <Card className="card-pastel-green" title="Користувачі" subTitle="Зареєстровано">
            <h2 className='my-0'><i className='pi pi-users' style={{ fontSize: '1.5rem' }} /> {totalUsers}</h2>
          </Card>
        </div>
        <div className="col-12 md:col-4">
          <Card className="card-pastel-pink" title="Активні за місяць" subTitle="Читають книги">
            <h2 className='my-0'><i className='pi pi-file-pdf' style={{ fontSize: '1.5rem' }} /> {activeUsers}</h2>
          </Card>
        </div>
      

        <div className="col-12 md:col-6">
          {/* Кругова діаграма розподілу за жанрами */}
          <Panel className='panel-statistic' header="Розподіл книг за жанрами">
            <div className="chart-wrapper">
              <Chart type="pie" data={booksByGenre} options={genreOptions} />
            </div>
          </Panel>
        </div>

        <div className="col-12 md:col-6">
          {/* Стовпчаста діаграма активности */}
          <Panel className='panel-statistic' header="Активність читання за півроку">
            <Chart type="bar" data={readingActivity}  />
          </Panel>
        </div>
      </div>

      {/* Топ книги */}
      <Panel className='panel-statistic' header="Топ-5 книг">
        <DataTable value={topBooks} loading={loading} showGridlines stripedRows size="small" emptyMessage="Дані відсутні">
          <Column field="bookName" header="Назва" className="font-medium text-primary" />
          <Column field="authors" header="Автори" />
          <Column field="cntUnfinished" header="Читають" alignHeader='center' align='center' />
          <Column field="cntFinished" header="Прочитали" alignHeader='center' align='center' />
        </DataTable>
      </Panel>

      {/* Топ автори */}
      <Panel className='panel-statistic' header="Топ-5 авторів">
        <DataTable value={topAuthors} loading={loading} showGridlines stripedRows size="small" emptyMessage="Дані відсутні">
          <Column field="authorInfo" header="Автор" className="font-medium text-primary" />
          <Column field="cntBooks" header="Загалом книг автора" alignHeader='center' align='center' type="number" />
          <Column field="cntUnfinished" header="Читають" alignHeader='center' align='center' type="number" />          
          <Column field="cntFinished" header="Прочитано екземплярів книг" alignHeader='center' align='center' type="number" />
        </DataTable>
      </Panel>

      {/* Топ користувачі */}
      <Panel className='panel-statistic' header="Найактивніші користувачі">
        <DataTable value={topUsers} loading={loading} showGridlines stripedRows size="small" emptyMessage="Дані відсутні">
          <Column field="userInfo" header="Користувач" className="font-medium text-primary" />
          <Column field="cntUnfinished" header="Читає" alignHeader='center' align='center' type="number" />
          <Column field="cntFinished" header="Прочитано" alignHeader='center' align='center' type="number" />
        </DataTable>
      </Panel>

    </div>
  </>);
}