
import { useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { classNames } from 'primereact/utils';
import { Toast } from 'primereact/toast';
import { FileUpload } from 'primereact/fileupload';
import { Tooltip } from 'primereact/tooltip';
import emptyBookImg from "../../assets/empty_book.jpg";

const CoverUpload = forwardRef(({ onChange }, ref) => {
  const fileUploadRef = useRef(null);
  const [totalSize, setTotalSize] = useState(0);

  // Функця створення файлу на основi строки base64
  const base64ToFile = (imageData, filename="Обкладинка.png") => {
    const [header, base64Str] = imageData.split(",");

    const byteString = atob(base64Str);
    const arrayBuffer = new ArrayBuffer(byteString.length);
    const intArray = new Uint8Array(arrayBuffer);

    for (let i = 0; i < byteString.length; i++) {
      intArray[i] = byteString.charCodeAt(i);
    }

    const blob = new Blob([intArray], { type: header });
    const imgFile = new File([blob], filename, { type: header });
    return imgFile;
  }

  // прокидуємо назовні метод setImgData()
  useImperativeHandle(ref, () => ({
    
    setImgData: (base64Str) => {
      if (base64Str) {
        const imgFile = base64ToFile(base64Str);
        // Завантажуємо джерело даних для fileUploadRef
        fileUploadRef?.current.setFiles([imgFile]);
        setTotalSize(imgFile.size);
      }
      else {
        fileUploadRef?.current.clear();
      }
    }
  }));

  // Дiї пiсля вибору файлу
  const onTemplateSelect = (e) => {
    const file = e.files[0];
    const reader = new FileReader();
    reader.onload = () => {
      onChange(reader.result);
    };
    reader.readAsDataURL(file);

    setTotalSize(file.size || 0);    
  };    

  // Дii пiсля очистки файлiв
  const onTemplateClear = () => {
    onChange(null);
    setTotalSize(0);
  };

  const headerTemplate = (options) => {
    const { className, chooseButton, cancelButton } = options;
    const formatedValue = fileUploadRef && fileUploadRef.current ? fileUploadRef.current.formatSize(totalSize) : '0 B';
    return (
      <div className={classNames([className, 'gap-0', 'py-2', 'flex', 'align-items-center'])}>
        {chooseButton}
        {cancelButton}
        <div className="flex align-items-center gap-3 ml-auto text-xs">
          <span>{formatedValue} / 1 MB</span>
        </div>
      </div>
    );
  };

  const itemTemplate = (file) => (
    <div className="flex justify-content-center my-0 py-0 overflow-x">
      <img alt={file.name} role="presentation" className="max-w-10rem h-12rem border-round-md"
        src={file.objectURL ? file.objectURL : URL.createObjectURL(file)} 
        style={{ maxHeight: 210, maxWidth: 250  }}/>
    </div>
  );

  const emptyTemplate = () => (
    <div className="flex flex-wrap justify-content-center my-0 py-0" >
      <img className="max-w-9rem h-11rem border-round-md" style={{ opacity: 0.9}}
        src={emptyBookImg} 
        alt="Фото відсутнє" />      
      {/* <i className="pi pi-image mt-3 p-5" 
        style={{ fontSize: '4em', borderRadius: '50%', backgroundColor: 'var(--surface-b)', color: 'var(--surface-d)' }}></i> */}
      <span style={{ textAlign: 'center', fontSize: '0.8em', color: 'var(--text-color-secondary)' }} className="mt-2">
        Перетягніть сюди файл обкладинки для завантаження
      </span>
    </div>
  );

  const chooseOptions = { icon: 'pi pi-fw pi-images', iconOnly: true, className: 'custom-choose-btn p-button-rounded w-2rem h-2rem' };
  const cancelOptions = { icon: 'pi pi-fw pi-times', iconOnly: true, className: 'custom-cancel-btn p-button-danger p-button-rounded w-2rem h-2rem' };

  // -------------------------------------------------------------------------------------------------
  return (
    <div className='overflow-x'>
      <Tooltip target=".custom-choose-btn" content="Обрати" position="bottom" />
      <Tooltip target=".custom-cancel-btn" content="Очистити" position="bottom" />

      <FileUpload
        ref={fileUploadRef} multiple={false} accept="image/*" maxFileSize={1048576}
        invalidFileSizeMessageDetail="Макс. розмір - 1Мб"
        onSelect={onTemplateSelect} onError={onTemplateClear} onClear={onTemplateClear}
        headerTemplate={headerTemplate} itemTemplate={itemTemplate} emptyTemplate={emptyTemplate}
        chooseOptions={chooseOptions} cancelOptions={cancelOptions} />
    </div>
  )
})

export default CoverUpload;

        