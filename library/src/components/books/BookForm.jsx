import { useContext, useRef, useState, useEffect } from "react";
import PropTypes from 'prop-types';
import { useForm, Controller } from 'react-hook-form';
import { classNames } from 'primereact/utils';
import { AppContext } from "../context/AppContext";
import './Book.css';
import { Card, InputText, InputNumber, Dropdown, MultiSelect, Panel, 
  InputTextarea, FloatLabel, Button, Toast, FileUpload } from 'primereact';
import CoverUpload from "./CoverUpload";
import { getBook, bookNew, bookEdit } from "../../utils/book";
import { uploadFileContent, deleteFileContent } from "../../utils/content";

BookForm.propTypes = {
  closeForm: PropTypes.func,
  updateData: PropTypes.func,
  bookId: PropTypes.string
};

export default function BookForm({closeForm, updateData, bookId}) {
  // Значення за замовчувааням для книги
  const [defaultBook, setDefaultBook] = useState({ 
    "bookId": null,
    "isbn": null,
    "bookName": "",
    "bookYear": (new Date()).getFullYear(),
    "languageId": null,
    "bookCover": null,
    "authors": [],
    "genres": [],
    "annotation": "",
    "keyWords": ""
  });
  // Ім'я файлу зі змістом книги (за відсутності редагування співпадає з defaultBook.source)
  // Але оскільки додавання/видалення змісту одразу супровождується записом до БД,
  // то ми окремо зберігаємо ці дані у відповідному state, щоб не затерти інші незбережені зміни на формі
  const [fileContent, setFileContent] = useState(null);
  
  const { 
    control, 
    handleSubmit, 
    reset,
    formState: { 
      errors, 
      isDirty, 
      isValid, 
    },
    clearErrors
  } = useForm({ mode: 'onChange', defaultBook }); 

  const { catalogs } = useContext(AppContext);
  const toast = useRef(null);  
  const coverUploadRef = useRef(null);  

  // Завантаження даних
  const loadData = async() => {

    const data = await getBook(bookId, toast);
    if (data) {
      // Записуємо нові default-дані      
      setDefaultBook(data);
      setFileContent(data.source);
    }
  }

  // При завантаженнi компоненту для bookId !== undefined виклик завантаження даних з серверу
  useEffect(() => {
    if (bookId !== undefined)
      loadData();
  }, [])
  
  
  // Зберегти зміни
  const applyChanges = async(data) => {

    if (data?.bookId === null) {
      const newBook = await bookNew(data, toast);
      // Якщо додавання пройшло успішно
      if (newBook) {
        // Записуємо нові default-дані
        setDefaultBook(newBook);
        // Оновити список книг
        updateData();
      }
    }
    else {
      const editedBook = await bookEdit(data, toast);
      // Якщо зміна даних пройшла успішно
      if (editedBook) {
        // Закриваємо вікно форми
        closeForm();
        // Оновити дані книги у списку книг
        updateData(editedBook);
      }
    }
  }

  // Повертаємо default дані 
  const resetChanges = () => {
    reset(defaultBook); 
    coverUploadRef.current?.setImgData(defaultBook.bookCover);
  }   

  // При зміні значення defaultBook значення полів форми за замовчуванням - defaultBook
  useEffect(() => {
    resetChanges();
  }, [defaultBook])


  const onNextBook = () => { 
    setDefaultBook({ 
        "bookId": null,
        "isbn": null,
        "bookName": "",
        "bookYear": (new Date()).getFullYear(),
        "languageId": null,
        "bookCover": null,
        "authors": [],
        "genres": [],
        "annotation": "",
        "keyWords": ""      
      });
    setFileContent(null);   
  }


  const getFormErrorMessage = (name) => (
    errors[name] && <small className="p-error">{errors[name].message}</small>
  );

  const dropDownValueLangTemplate = (option, props) => {
    if (option && option !== undefined) {
      return (
        <div className="flex mr-2 text-sm">
          <span style={{ backgroundColor: 'var(--primary-color)' }} className="text-white font-bold px-1 mr-2">
            {option.code}
          </span> 
          {option.name}
        </div>
      );
    }
    return <span className="text-sm">{props.placeholder}</span>;
  };
  
  const dropDownOptionLangTemplate = (option) => (
    <div className="text-sm mr-2">
      <span className="text-primary font-bold px-1 mr-2">{option.code}</span> {option.name}
    </div>
  );

  const dropDownItemMultiselectTemplate = (option) => (
    <div className="flex justify-content-start text-sm mr-2">
      {option.name}
    </div>
  )

  const onUploadedFileContent = async(e) => {
    const formData = new FormData();
    for (let file of e.files) {
      formData.append("file", file);
    }
    const fileName = await uploadFileContent(formData, defaultBook.bookId, toast);
    if (fileName) {
      setFileContent(fileName);
      updateData({ bookId: defaultBook.bookId, source: fileName });
    }
  }

  const onDeletedFileContent = async() => {
    const result = await deleteFileContent(fileContent, defaultBook.bookId, toast);
    if (result) {
      setFileContent(null);
      updateData({ bookId: defaultBook.bookId, source: null });
    }
  }

  const footer = (
    <div className="field flex justify-content-center gap-4 my-0 py-0">
      {/* Зберегти зміни */}
      <Button icon="pi pi-save" disabled={!isDirty || !isValid} type="submit" 
        label="Зберегти" className="m-0 text-sm w-8rem" 
        rounded severity="success" />

      {/* Скасувати */}
      <Button icon="pi pi-undo" disabled={!isDirty} type="reset" 
        label="Скасувати" className="m-0 text-sm w-8rem" 
        outlined rounded />

      {/* Наступна */}
      <Button icon="pi pi-step-forward" type="button"
        className={`m-0 text-sm w-9rem ${(isDirty || !defaultBook.bookId || bookId) ? "hidden" : "block"}`}
        label="Наступна" rounded severity="warning"
        onClick={onNextBook}
      />        
    </div>                  
  )
  
  // --------------------------------------------------------------------------------------------
  return (
  <>
    <Toast ref={toast} />      
    <form className="p-fluid" onSubmit={handleSubmit(applyChanges)} onReset={resetChanges} >
      <Card footer={footer} className="mt-1 py-0">
        <div className="card formgrid grid gap-0 my-0 py-0">
          <div className="col-12 md:col-7 xl:col-8 formgrid grid my-0 py-0">
            
            {/* Назва книги */}
            <div className="field col-12 text-sm my-0">
              <label htmlFor="bookName" className={classNames({ 'p-error': errors.bookName })}>Назва книги*: </label>
              <Controller name="bookName" control={control} 
                rules={{ 
                  required: "Введіть назву книги"           
                }}
                render={({ field, fieldState }) => (                   
                  <InputText id={field.name} {...field} 
                    className={ classNames([{ 'p-invalid': fieldState.invalid }, 'text-sm'])}
                    onChange={(e) => field.onChange(e.target.value)}
                    onFocus={() => clearErrors(field.name)} />          
              )} />
              {getFormErrorMessage('bookName')}         
            </div> 

            {/* Рік видання */}
            <div className="field col-12 md:col-5 text-sm my-0">
              <label htmlFor="bookYear" className={classNames({ 'p-error': errors.bookYear })}>Рік&nbsp;видання*: </label>
              <Controller name="bookYear" control={control} 
                rules={{ 
                  required: "Введіть рік видання"           
                }}
                render={({ field, fieldState }) => (                   
                  <InputNumber id={field.name} {...field} useGrouping={false} 
                    className={ classNames([{ 'p-invalid': fieldState.invalid }, 'text-sm' ])}
                    showButtons max={(new Date()).getFullYear()}
                    onChange={(e) => field.onChange(e.value)}
                    onFocus={() => clearErrors(field.name)} />          
              )} />
              {getFormErrorMessage('bookYear')}         
            </div>  

            {/* Мова */}
            <div className="field col-12 md:col-7 text-sm my-0">
              <label htmlFor="languageId" className={classNames({ 'p-error': errors.languageId })}>Мова*: </label>
              <Controller name="languageId" control={control} 
                rules={{ 
                  required: "Оберіть мову книги"           
                }}
                render={({ field, fieldState }) => (                   
                  <Dropdown id={field.name} {...field} 
                    onChange={(e) => e.value === undefined ? null : field.onChange(e.target.value)}
                    options={catalogs?.languages} 
                    optionValue="id" placeholder="Оберіть мову" 
                    className={ classNames([{ 'p-invalid': fieldState.invalid }, 'text-sm'])}
                    valueTemplate={dropDownValueLangTemplate} itemTemplate={dropDownOptionLangTemplate} />         
                    )} />
              {getFormErrorMessage('languageId')}         
            </div>

            {/* Автори */}
            <div className="field col-12 text-sm my-0">
              <label htmlFor="authors" className={classNames({ 'p-error': errors.authors })}>Автор(и)*: </label>
              <Controller name="authors" control={control} 
                rules={{ 
                  required: "Оберіть автора(ів)"           
                }}
                render={({ field, fieldState }) => (                   
                  <MultiSelect id={field.name} {...field} 
                    options={catalogs?.authors} optionValue="id" optionLabel="name" display="chip"
                    itemTemplate={dropDownItemMultiselectTemplate}
                    onChange={(e) => e.value === undefined ? null : field.onChange(e.target.value)}   
                    className={ classNames([{ 'p-invalid': fieldState.invalid }, 'text-sm'])}              
                    filter filterDelay={400} 
                    emptyFilterMessage="Значень не знайдено"
                    placeholder="Оберіть автора(ів)" maxSelectedLabels={5} />    
              )} />
              {getFormErrorMessage('authors')}         
            </div>  

            {/* Жанри */}
            <div className="field col-12 text-sm my-0">
              <label htmlFor="genres" className={classNames({ 'p-error': errors.genres })}>Жанр(и)*: </label>
              <Controller name="genres" control={control} 
                rules={{ 
                  required: "Оберіть жанр(и)"           
                }}
                render={({ field, fieldState }) => (                   
                  <MultiSelect id={field.name} {...field} 
                    options={catalogs?.genres} optionValue="id" optionLabel="name" display="chip"
                    itemTemplate={dropDownItemMultiselectTemplate}
                    onChange={(e) => e.value === undefined ? null : field.onChange(e.target.value)} 
                    className={ classNames([{ 'p-invalid': fieldState.invalid }, 'text-sm'])}                          
                    filter filterDelay={400} 
                    emptyFilterMessage="Значень не знайдено"
                    placeholder="Оберіть жанр(и)" maxSelectedLabels={5} />
              )} />
              {getFormErrorMessage('genres')}         
            </div>   
          </div>   

          {/* Обкладинка */}
          <Controller name="bookCover" control={control} 
            render={({ field }) => (              
            <div className="col-12 md:col-5 xl:col-4 px-0 mx-0">
              <CoverUpload {...field} onChange={field.onChange} toastRef={toast} ref={coverUploadRef} />
            </div> 
          )} />

          <div className="field col-12 mb-0">
          <Panel 
              headerTemplate={(options) => (
              <div className="flex align-items-center">
                {/* Кнопка закриття/відкриття ліворуч */}
                <Button
                  icon={options.collapsed ? "pi pi-chevron-right" : "pi pi-chevron-down"} size="small"
                  onClick={options.onTogglerClick} text rounded className="mr-2" />
                
                <div className="flex flex-wrap justify-content-center align-items-center gap-4">
                  <span>
                    Зміст, анотація, ключові слова
                  </span>
                  <div className="flex flex-wrap justify-content-center align-items-center gap-2">
                    {defaultBook.bookId && !fileContent && 
                    // Завантажити файл зі змістом книги 
                    <FileUpload mode="basic" name="demo[]" multiple={false}  
                      maxFileSize={100000000} // 100 MB
                      //accept=".pdf,.epub,application/pdf,application/epub+zip" 
                      accept=".pdf,application/pdf" 
                      customUpload uploadHandler={onUploadedFileContent} auto chooseLabel="Завантажити зміст" 
                      chooseOptions={{
                        icon: 'pi pi-download', 
                        severity: 'success',
                        className: 'custom-choose-btn p-button-rounded p-button-success h-2rem text-xs'}} 
                    /> }
                    
                    {defaultBook.bookId && fileContent && 
                    <>
                    {/* Видалити зміст книги */}
                    <font className="text-xs font-italic">Файл: {fileContent}</font>
                    <Button type="button" icon="pi pi-times" className="h-2rem text-xs w-10rem" rounded severity="danger"
                    label="Видалити зміст" onClick={onDeletedFileContent} />
                    </>}                
                  </div>
                </div>
              </div>
            )} 
            toggleable collapsed={true}
            className="text-sm mt-2 mb-0">
            
            {/* Анотація */}              
            <Controller name="annotation" control={control} 
              render={({ field }) => (  
              <FloatLabel className='mt-2'>                
                <InputTextarea autoResize id={field.name} {...field} 
                  className='text-sm mb-2'
                  onChange={(e) => field.onChange(e.target.value)}
                  onFocus={() => clearErrors(field.name)}
                  rows={5} cols={30} />   
                <label htmlFor={field.name}>Анотація</label>
              </FloatLabel>                    
            )} />

            {/* Ключові слова */}    
            <Controller name="keyWords" control={control} 
              render={({ field }) => ( 
              <FloatLabel className='mt-3'>
                <InputTextarea autoResize id={field.name} {...field} 
                    className='text-sm'
                    onChange={(e) => field.onChange(e.target.value)}
                    onFocus={() => clearErrors(field.name)}
                    rows={3} cols={30} />  
                <label htmlFor={field.name}>Ключові слова</label>
              </FloatLabel>  
            )} />  
          </Panel> 
          </div>

        </div>                        
      </Card> 
    </form>    
  </>
  )
}