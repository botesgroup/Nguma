import{s as c}from"./index-Bwp57zE4.js";const _=async()=>{const{data:a,error:t}=await c.rpc("get_accounting_stats");if(t)throw t;return a},d=async(a,t)=>{const{data:r,error:e}=await c.rpc("get_upcoming_profits",{p_start_date:a?.toISOString(),p_end_date:t?.toISOString()});if(e)throw e;return r},p=async()=>{const{data:a,error:t}=await c.rpc("generate_withdrawal_batch");if(t)throw t;return a},u=async(a,t)=>{const{error:r}=await c.rpc("process_payment_batch",{p_batch_id:a,p_proof_url:t});if(r)throw r},f=async()=>{const{data:a,error:t}=await c.from("payment_batches").select("*").order("created_at",{ascending:!1});if(t)throw t;return a},m=async a=>{const{data:t,error:r}=await c.from("payment_batch_items").select(`
      *,
      profiles:user_id (email, full_name)
    `).eq("batch_id",a);if(r)throw r;return t.map(e=>({...e,user_email:e.profiles?.email,user_name:e.profiles?.full_name}))},g=async(a,t,r)=>{let e=c.from("accounting_entries").select(`
      *,
      debit_account:debit_account_id (name),
      credit_account:credit_account_id (name)
    `).order("transaction_date",{ascending:!1});if(a&&(e=e.gte("transaction_date",a)),t){const n=new Date(t);n.setDate(n.getDate()+1),e=e.lt("transaction_date",n.toISOString())}r&&(e=e.ilike("description",`%${r}%`));const{data:o,error:s}=await e;if(s)throw s;return o.map(n=>({...n,debit_account_name:n.debit_account?.name,credit_account_name:n.credit_account?.name}))};export{d as a,p as b,f as c,m as d,g as e,_ as g,u as p};
