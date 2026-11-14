
//  Pure HTML + CSS + Bootstrap pages live at the project root and are copied tonthe public so each is served at its own path:
// 




export default function app(){
    return (
      <iframe
       title="Makazi Care- sign in"
       src="/authpage.html"
       style={{
        position:"fixed"
        inset:0,
        width:"100%",
        height:"100%",
        border:"none",
        display:"block",
        background:"#FAF7F1"
       }}
       />

    );
}