"use client";

import {
  useEffect,
  useState,
} from "react";

import { portalApi } from "@/lib/portal-api";
import { invoiceApi } from "@/lib/invoice-api";


export default function ClientInvoiceDetailPage({
  params,
}: {
  params: {
    invoiceId: string;
  };
}) {

  const [invoice,setInvoice] =
    useState<any>(null);

  const [loading,setLoading] =
    useState(true);

  const [paying,setPaying] =
    useState(false);


  useEffect(() => {

    portalApi
      .invoice(params.invoiceId)
      .then(setInvoice)
      .catch(console.error)
      .finally(() =>
        setLoading(false)
      );

  },[params.invoiceId]);



  async function payInvoice(){

    if(!invoice) return;


    try {

      setPaying(true);


      const result =
        await invoiceApi.createCheckout(
          invoice.id,
          {
            amount:String(
              invoice.balanceDue
              ??
              invoice.total
              ??
              "0",
            ),
          },
        );


      if(result.checkout.url){

        window.location.href =
          result.checkout.url;

      }


    }catch(error){

      console.error(error);

      alert(
        "Unable to start payment",
      );

    }
    finally{

      setPaying(false);

    }

  }



  if(loading){

    return (
      <main className="p-8">
        Loading invoice...
      </main>
    );

  }



  if(!invoice){

    return (
      <main className="p-8">
        Invoice not found.
      </main>
    );

  }



  return (

    <main className="min-h-screen bg-[#fafafa] p-6">

      <div className="mx-auto max-w-3xl rounded-3xl border bg-white p-8">


        <h1 className="text-3xl font-semibold">
          Invoice {invoice.invoiceNumber}
        </h1>


        <div className="mt-8 grid gap-5 rounded-2xl bg-gray-50 p-6">


          <div>
            Status:
            <strong className="ml-2">
              {invoice.status}
            </strong>
          </div>


          <div>
            Balance Due:
            <strong className="ml-2">
              {invoice.balanceDue}
            </strong>
          </div>


        </div>



        <button

          onClick={payInvoice}

          disabled={paying}

          className="mt-8 w-full rounded-xl bg-black py-4 text-white"

        >

          {
            paying
            ?
            "Opening payment..."
            :
            "Pay Invoice"
          }


        </button>


      </div>

    </main>

  );

}