export const notify = {
  success: (toast, header, msg) => {
    if (toast)
      toast.current.show({ severity: 'success', summary: header, detail: msg });
    else
      window.alert(header + (header !== "" ? ": " : "") + msg);
  },

  error: (toast, header, msg) => {
    if (toast)
      toast.current.show({ severity: 'error',  sticky: true, summary: header, detail: msg });
    else
      window.alert(header + (header !== "" ? ": " : "") + msg);
  },

  warn: (toast, header, msg) => {
    if (toast)
      toast.current.show({ severity: 'warn', summary: header, detail: msg });
    else
      window.alert(header + (header !== "" ? ": " : "") + msg);
  },
  
  info: (toast, header, msg) => {
    if (toast)
      toast.current.show({ severity: 'info', summary: header, detail: msg });
    else
      window.alert(header + (header !== "" ? ": " : "") + msg);
  }  

};
