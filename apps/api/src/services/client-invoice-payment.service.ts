import { prisma } from "../config/database.js";

export const clientInvoicePaymentService = {

  async getInvoice(
    clientId: string,
    invoiceId: string,
  ) {

    console.log("CLIENT ID:", clientId);
    console.log("INVOICE ID:", invoiceId);


    const invoice =
      await prisma.invoice.findUnique({
        where:{
          id: invoiceId,
        },
        include:{
          client:true,
        },
      });


    console.log("FOUND INVOICE:", invoice);


    if(!invoice){
      return null;
    }


    return invoice.clientId === clientId
      ? invoice
      : null;
  },


  async getPublishedInvoices(clientId:string){

    return prisma.invoice.findMany({
      where:{
        clientId,
      },
      orderBy:{
        createdAt:"desc",
      },
    });

  },

};