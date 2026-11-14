
/**   Pure HTML + CSS + Bootstrap pages live at the project root and are copied tonthe public so each is served at its own path:
* - landingpage.html (public landing page)
* - tenanthomepage.html (tenant home)
* - landlordhomepage.html (landlord home)
*   propertymanager.html (property manager home)
*   tenantslist.html ( shared tenants directory)
*   maintenance.html ( tenant maintenance requests)
*   relocation.html (tenant relocation requests)
*   apartments.html (landlord apartments & house types)
*   tenantreceipts.html (tenant payment receipts)
*   extension.html ( tenant rent extension request)
*   extensionrequests.html ( landlord decision extension queue)
*   propertymanagerlist ( landlord manager onboarding)
*   paymentreport.html (landlord payment report)
*   pmpaymentreport.html (manager's payment report)
*   pmrequests.html  ( manager maintenance requests)
* 
   


*/


export default function app(){
    return (
      < iframe
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