import { useState, useContext } from 'react';
import PropTypes from 'prop-types';
import { useForm, useWatch, Controller } from 'react-hook-form';
import { AppContext } from '../context/AppContext';
import { Card, MultiSelect, AutoComplete, InputNumber, Rating, Button, RadioButton } from 'primereact';
import { searchNameBook } from '../../utils/book';

FilterForm.propTypes = {
  closeForm: PropTypes.func
};

export default function FilterForm({closeForm}) {
  const { catalogs, user, filters, setFilters } = useContext(AppContext); 
  const [defaultFilters] = useState({ 
    "bookName": "",
    "minYear": 0,
    "maxYear": (new Date()).getFullYear(),
    "languages": [],
    "authors": [],
    "genres": [],
    "rating": 0,
    "isRead": "-1"
  });

  const defaultValues = filters ?? defaultFilters;
  const { 
    control, 
    handleSubmit, 
    reset,
    formState: { 
      isDirty, 
      isValid, 
    },
  } = useForm({ mode: 'onChange', defaultValues}); 
  const [results, setResults] = useState([]);
  
  // тут "слідкуємо" за значеннями у полях вводу, щоб зробити bold-шрифт, якщо значення задані
  const bookName = useWatch({ control, name: "bookName" });
  const authors = useWatch({ control, name: "authors" });
  const genres = useWatch({ control, name: "genres" });
  const languages = useWatch({ control, name: "languages" });
  const minYear = useWatch({ control, name: "minYear" }); 
  const maxYear = useWatch({ control, name: "maxYear" });   
  const rating = useWatch({ control, name: "rating" });   
  
  const search = async(e) => {
    const searchStr = e.query.trim();
    if (searchStr.length < 2) return;

    const response = await searchNameBook(searchStr);
    if (response) {
      setResults(response);
    }
  } 

  const applyChanges = async(data) => {
    if (JSON.stringify(data) != JSON.stringify(defaultFilters))
      setFilters(data);
    else
      setFilters(null);
    closeForm();
  }

  // Повертаємо default дані 
  const resetChanges = () => {
    reset(defaultFilters); 
    setFilters(null);
    closeForm();
  }  

  const dropDownItemMultiselectTemplate = (option) => (
    <div className="flex justify-content-start text-sm mr-2">
      {option.name}
    </div>
  )  

  const header = (
    <h4>
      <i className='pi pi-spin pi-compass mx-2' style={{ fontSize: '1.5rem', color: 'var(--primary-color)' }}></i>
      Параметри пошуку
    </h4>
  )

  const footer = (
    <div className="field flex justify-content-center gap-4 my-0 py-0">
      {/* Застосувати */}
      <Button icon="pi pi-filter" disabled={!isDirty || !isValid} type="submit" 
        label="Застосувати" className="m-0 text-sm w-10rem" 
        rounded severity="success" />
      
      {/* Скасувати */}
      <Button icon="pi pi-undo" disabled={defaultValues === defaultFilters && !isDirty} type="reset" 
        label="Скасувати" className="m-0 text-sm w-9rem" 
        outlined rounded />     
    </div>                  
  )

  // ---------------------------------------------------------------
  return (
    <>
    <form className="p-fluid" onSubmit={handleSubmit(applyChanges)} onReset={resetChanges} >
      <Card header={header} footer={footer} className="my-0 py-0">
        <div className="card formgrid grid gap-0 my-0 py-0">            
            {/* Назва + Ключові слова */}
            <div className="field col-12 text-sm mt-0">
              <label htmlFor="bookName" className={bookName?.length !== 0 ? 'font-bold' : ''}>Назва книги: </label>
              <Controller name="bookName" control={control} 
                render={({ field }) => (                   
                  <AutoComplete id={field.name} {...field}
                    //value={query}
                    suggestions={results}
                    completeMethod={search}
                    onChange={(e) => field.onChange(e.value)}
                    placeholder="Пошук книжок..."
                />    
              )} />     
            </div>

            {/* Автори */}
            <div className="field col-12 md:col-6 text-sm mt-0">
              <label htmlFor="authors" className={authors?.length !== 0 ? 'font-bold' : ''}>Автор(и): </label>
              <Controller name="authors" control={control} 
                render={({ field }) => (                   
                  <MultiSelect id={field.name} {...field} 
                    options={catalogs?.authors} optionValue="id" optionLabel="name" display="chip"
                    itemTemplate={dropDownItemMultiselectTemplate}
                    onChange={(e) => e.value === undefined ? null : field.onChange(e.target.value)}   
                    className='text-sm'            
                    filter filterDelay={400} 
                    emptyFilterMessage="Значень не знайдено"
                    placeholder="Оберіть автора(ів)" maxSelectedLabels={5} />    
              )} />     
            </div>  

            {/* Жанри */}
            <div className="field col-12 md:col-6 text-sm mt-0">
              <label htmlFor="genres" className={genres?.length !== 0 ? 'font-bold' : ''}>Жанр(и): </label>
              <Controller name="genres" control={control} 
                render={({ field }) => (                   
                  <MultiSelect id={field.name} {...field} 
                    options={catalogs?.genres} optionValue="id" optionLabel="name" display="chip"
                    itemTemplate={dropDownItemMultiselectTemplate}
                    onChange={(e) => e.value === undefined ? null : field.onChange(e.target.value)} 
                    className='text-sm'                          
                    filter filterDelay={400} 
                    emptyFilterMessage="Значень не знайдено"
                    placeholder="Оберіть жанр(и)" maxSelectedLabels={5} />
              )} />
            </div>   

           {/* Мова */}
            <div className="field col-12 md:col-6 text-sm mb-0">
              <label htmlFor="languages" className={languages?.length !== 0 ? 'font-bold' : ''}>Мова(и): </label>
              <Controller name="languages" control={control} 
                render={({ field }) => (                   
                  <MultiSelect id={field.name} {...field} 
                    options={catalogs?.languages} optionValue="id" optionLabel="name" display="chip"
                    itemTemplate={dropDownItemMultiselectTemplate}
                    onChange={(e) => e.value === undefined ? null : field.onChange(e.target.value)} 
                    className='text-sm'                          
                    placeholder="Оберіть мову(и)" maxSelectedLabels={5} /> 
                )} />
            </div>

            {/* Роки видання */}
            <div className="field col-6 md:col-3 text-sm">
              <label htmlFor="minYear" className={minYear !== defaultFilters.minYear ? 'font-bold' : ''}>Рік&nbsp;видання з: </label>
              <Controller name="minYear" control={control} 
                render={({ field }) => (                   
                  <InputNumber id={field.name} {...field} useGrouping={false} 
                    className='text-sm'
                    showButtons max={(new Date()).getFullYear()}
                    onChange={(e) => field.onChange(e.value)}/>          
              )} />    
            </div>  
            <div className="field col-6 md:col-3 text-sm">
              <label htmlFor="maxYear" className={maxYear !== defaultFilters.maxYear ? 'font-bold' : ''}>по: </label>
              <Controller name="maxYear" control={control} 
                render={({ field }) => (                   
                  <InputNumber id={field.name} {...field} useGrouping={false} 
                    className='text-sm'
                    showButtons max={(new Date()).getFullYear()}
                    onChange={(e) => field.onChange(e.value)}/>          
              )} />    
            </div>  
            {/* Рейтинг */} 
            <div className="field col-12 md:col-6 text-sm mb-0">
              <label htmlFor="rating" className={rating != defaultFilters.rating ? 'font-bold' : ''}>Рейтинг: </label>
              <Controller name="rating" control={control} 
                render={({ field }) => (
                  <Rating id={field.name} {...field} className='text-sm' 
                    onChange={(e) => field.onChange(e.value === null ? 0 : e.value)} cancel></Rating>                                      
              )} />                     
            </div> 
            {/* Ознаки прочитаного */}
            <div className="field col-12 md:col-6 text-sm mb-0">
              {user?.userId > 0 &&
              <Controller name="isRead" control={control} 
                render={({ field }) => (
                  <div className="flex flex-wrap gap-3 mt-2">
                      <div className="flex align-items-center">
                          <RadioButton inputId="isReadNone" {...field} value="-1" 
                          onChange={(e) => field.onChange(e.value)} checked={field.value === "-1"} />
                          <label htmlFor="isReadNone" className="ml-2">Всі</label>
                      </div>
                      <div className="flex align-items-center">
                          <RadioButton inputId="isRead" {...field} value="1" 
                          onChange={(e) => field.onChange(e.value)}  checked={field.value === "1"} />
                          <label htmlFor="isRead" className="ml-2"> 
                            <i className='pi pi-flag-fill' style={{ color: 'green' }}/> Прочитані
                          </label>
                      </div>
                      <div className="flex align-items-center">
                          <RadioButton inputId="isReading" {...field} value="2" 
                          onChange={(e) => field.onChange(e.value)}  checked={field.value === "2"} />
                          <label htmlFor="isRead" className="ml-2"> 
                            <i className='pi pi-flag' style={{ color: 'green' }}/> Читаю
                          </label>
                      </div>                      
                      <div className="flex align-items-center">
                          <RadioButton inputId="isNotRead" {...field} value="0" 
                          onChange={(e) => field.onChange(e.value)}  checked={field.value === "0"} />
                          <label htmlFor="isNotRead" className="ml-2">
                            Непрочитані
                          </label>
                      </div>
                  </div>                  
              )} />
            }                     
            </div>              
        </div>                        
      </Card> 
    </form>       
    </>
  )
}