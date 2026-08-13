import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import {
  createElement as h,
  type ReactElement,
} from "react";

import type {
  InvoiceDto,
} from "@clientflow/contracts";

const BRAND = "#235F55";
const BRAND_SOFT = "#DCEBE5";
const INK = "#191A17";
const MUTED = "#6D7169";
const BORDER = "#D9DBD3";
const SURFACE = "#F6F6F2";
const DANGER = "#B84545";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

const styles = StyleSheet.create({
  page: {
    paddingTop: 38,
    paddingRight: 42,
    paddingBottom: 58,
    paddingLeft: 42,
    fontFamily: "Helvetica",
    fontSize: 9,
    color: INK,
    lineHeight: 1.35,
    backgroundColor: "#FFFFFF",
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  brandBlock: {
    width: "58%",
  },
  brandEyebrow: {
    fontSize: 7,
    textTransform: "uppercase",
    letterSpacing: 1.4,
    color: MUTED,
    marginBottom: 5,
  },
  brandName: {
    fontSize: 19,
    fontWeight: "bold",
    color: BRAND,
    marginBottom: 5,
  },
  brandMeta: {
    fontSize: 8,
    color: MUTED,
    lineHeight: 1.45,
    maxWidth: 270,
  },
  invoiceHeading: {
    width: "38%",
    alignItems: "flex-end",
  },
  invoiceEyebrow: {
    fontSize: 7,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    color: MUTED,
    marginBottom: 5,
  },
  invoiceNumber: {
    fontSize: 20,
    fontWeight: "bold",
    color: INK,
    marginBottom: 7,
    textAlign: "right",
  },
  statusPill: {
    borderRadius: 3,
    paddingTop: 4,
    paddingRight: 7,
    paddingBottom: 4,
    paddingLeft: 7,
    fontSize: 7,
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  statusNormal: {
    backgroundColor: BRAND_SOFT,
    color: BRAND,
  },
  statusDanger: {
    backgroundColor: "#F7E4E4",
    color: DANGER,
  },
  draftNote: {
    marginTop: 7,
    fontSize: 7,
    color: MUTED,
    textAlign: "right",
  },

  facts: {
    flexDirection: "row",
    marginTop: 14,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 4,
    backgroundColor: SURFACE,
  },
  fact: {
    flexGrow: 1,
    flexBasis: 0,
    paddingTop: 9,
    paddingRight: 10,
    paddingBottom: 9,
    paddingLeft: 10,
    borderRightWidth: 1,
    borderRightColor: BORDER,
  },
  factLast: {
    borderRightWidth: 0,
  },
  label: {
    fontSize: 6.5,
    textTransform: "uppercase",
    letterSpacing: 0.9,
    color: MUTED,
    marginBottom: 4,
  },
  value: {
    fontSize: 9,
    fontWeight: "bold",
    color: INK,
  },

  parties: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 15,
  },
  party: {
    width: "48.5%",
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 4,
    paddingTop: 12,
    paddingRight: 13,
    paddingBottom: 12,
    paddingLeft: 13,
    minHeight: 108,
  },
  partyTitle: {
    fontSize: 6.5,
    textTransform: "uppercase",
    letterSpacing: 1.1,
    color: MUTED,
    marginBottom: 7,
  },
  partyName: {
    fontSize: 11,
    fontWeight: "bold",
    color: INK,
    marginBottom: 5,
  },
  partyLine: {
    fontSize: 8,
    color: MUTED,
    marginBottom: 2,
  },

  section: {
    marginTop: 18,
  },
  sectionTitle: {
    fontSize: 8,
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 1,
    color: INK,
    marginBottom: 8,
  },

  table: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 4,
    overflow: "hidden",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: SURFACE,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    paddingTop: 7,
    paddingBottom: 7,
  },
  tableHeaderText: {
    fontSize: 6.5,
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 0.65,
    color: MUTED,
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    paddingTop: 8,
    paddingBottom: 8,
  },
  tableRowLast: {
    borderBottomWidth: 0,
  },
  descriptionColumn: {
    width: "37%",
    paddingLeft: 9,
    paddingRight: 7,
  },
  qtyColumn: {
    width: "9%",
    paddingRight: 6,
    textAlign: "right",
  },
  unitColumn: {
    width: "16%",
    paddingRight: 6,
    textAlign: "right",
  },
  discountColumn: {
    width: "11%",
    paddingRight: 6,
    textAlign: "right",
  },
  taxColumn: {
    width: "10%",
    paddingRight: 6,
    textAlign: "right",
  },
  totalColumn: {
    width: "17%",
    paddingRight: 9,
    textAlign: "right",
  },
  lineDescription: {
    fontSize: 8,
    color: INK,
  },
  lineNumber: {
    fontSize: 7.5,
    color: INK,
  },

  summaryWrap: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 12,
  },
  summary: {
    width: 235,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 4,
    overflow: "hidden",
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 6,
    paddingRight: 9,
    paddingBottom: 6,
    paddingLeft: 9,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  summaryRowLast: {
    borderBottomWidth: 0,
  },
  summaryLabel: {
    fontSize: 7.5,
    color: MUTED,
  },
  summaryValue: {
    fontSize: 7.5,
    fontFamily: "Helvetica",
    color: INK,
  },
  summaryStrong: {
    backgroundColor: SURFACE,
  },
  summaryStrongLabel: {
    fontSize: 8.5,
    fontWeight: "bold",
    color: INK,
  },
  summaryStrongValue: {
    fontSize: 9,
    fontWeight: "bold",
    color: BRAND,
  },

  copyGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
  },
  copyCard: {
    width: "48.5%",
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 4,
    paddingTop: 10,
    paddingRight: 11,
    paddingBottom: 10,
    paddingLeft: 11,
  },
  copyTitle: {
    fontSize: 6.5,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: MUTED,
    marginBottom: 5,
  },
  copyText: {
    fontSize: 7.5,
    color: INK,
    lineHeight: 1.45,
  },

  voidBanner: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: "#E2B8B8",
    backgroundColor: "#FFF5F5",
    borderRadius: 4,
    paddingTop: 7,
    paddingRight: 9,
    paddingBottom: 7,
    paddingLeft: 9,
    fontSize: 8,
    fontWeight: "bold",
    color: DANGER,
    textAlign: "center",
  },

  footer: {
    position: "absolute",
    left: 42,
    right: 42,
    bottom: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    fontSize: 6.5,
    color: MUTED,
  },
  footerRight: {
    textAlign: "right",
  },
});

export type InvoicePdfResult = {
  buffer: Buffer;
  contentType: "application/pdf";
  filename: string;
};

function formatStatus(
  status: InvoiceDto["status"],
): string {
  return status
    .split("_")
    .map(
      (part) =>
        part.charAt(0) +
        part.slice(1).toLowerCase(),
    )
    .join(" ");
}

function formatDate(
  value: string | null,
): string {
  if (!value) {
    return "Not set";
  }

  const match =
    /^(\d{4})-(\d{2})-(\d{2})$/.exec(
      value,
    );

  if (!match) {
    return value;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const monthName =
    MONTHS[month - 1];

  if (
    !monthName ||
    !Number.isInteger(day)
  ) {
    return value;
  }

  return `${monthName} ${day}, ${year}`;
}

function formatDecimal(
  value: string,
  minimumFractionDigits: number,
  maximumFractionDigits: number,
): string {
  const negative =
    value.startsWith("-");
  const unsigned = negative
    ? value.slice(1)
    : value;

  const [
    integerPartRaw = "0",
    fractionPartRaw = "",
  ] = unsigned.split(".");

  const integerPart =
    integerPartRaw
      .replace(/^0+(?=\d)/, "")
      .replace(
        /\B(?=(\d{3})+(?!\d))/g,
        ",",
      ) || "0";

  let fraction =
    fractionPartRaw.slice(
      0,
      maximumFractionDigits,
    );

  while (
    fraction.length >
      minimumFractionDigits &&
    fraction.endsWith("0")
  ) {
    fraction =
      fraction.slice(0, -1);
  }

  while (
    fraction.length <
    minimumFractionDigits
  ) {
    fraction += "0";
  }

  return `${negative ? "-" : ""}${integerPart}${
    fraction ? `.${fraction}` : ""
  }`;
}

function money(
  currency: string,
  value: string,
): string {
  return `${currency} ${formatDecimal(
    value,
    2,
    4,
  )}`;
}

function quantity(
  value: string,
): string {
  return formatDecimal(
    value,
    0,
    4,
  );
}

function percentage(
  value: string,
): string {
  return `${formatDecimal(
    value,
    0,
    4,
  )}%`;
}

function safeFilenamePart(
  value: string,
): string {
  return value
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 80);
}

function filenameFor(
  invoice: InvoiceDto,
): string {
  const identifier =
    invoice.invoiceNumber ??
    `draft-${invoice.id.slice(0, 8)}`;

  const safe =
    safeFilenamePart(identifier) ||
    "invoice";

  return `invoice-${safe}.pdf`;
}

function partyCard(
  title: string,
  name: string,
  details: Array<
    string | null | undefined
  >,
): ReactElement {
  const lines = details.filter(
    (value): value is string =>
      Boolean(value),
  );

  return h(
    View,
    {
      style: styles.party,
      wrap: false,
    },
    h(
      Text,
      {
        style: styles.partyTitle,
      },
      title,
    ),
    h(
      Text,
      {
        style: styles.partyName,
      },
      name,
    ),
    ...(
      lines.length > 0
        ? lines
        : ["No additional billing details."]
    ).map((line, index) =>
      h(
        Text,
        {
          key: `${title}-${index}`,
          style: styles.partyLine,
        },
        line,
      ),
    ),
  );
}

function fact(
  label: string,
  value: string,
  last = false,
): ReactElement {
  return h(
    View,
    {
      style: [
        styles.fact,
        ...(last
          ? [styles.factLast]
          : []),
      ],
    },
    h(
      Text,
      {
        style: styles.label,
      },
      label,
    ),
    h(
      Text,
      {
        style: styles.value,
      },
      value,
    ),
  );
}

function summaryRow(
  label: string,
  value: string,
  options?: {
    strong?: boolean;
    last?: boolean;
  },
): ReactElement {
  const strong =
    options?.strong ?? false;
  const last =
    options?.last ?? false;

  return h(
    View,
    {
      style: [
        styles.summaryRow,
        ...(strong
          ? [styles.summaryStrong]
          : []),
        ...(last
          ? [styles.summaryRowLast]
          : []),
      ],
    },
    h(
      Text,
      {
        style: strong
          ? styles.summaryStrongLabel
          : styles.summaryLabel,
      },
      label,
    ),
    h(
      Text,
      {
        style: strong
          ? styles.summaryStrongValue
          : styles.summaryValue,
      },
      value,
    ),
  );
}

function copyCard(
  title: string,
  value: string | null,
): ReactElement {
  return h(
    View,
    {
      style: styles.copyCard,
    },
    h(
      Text,
      {
        style: styles.copyTitle,
      },
      title,
    ),
    h(
      Text,
      {
        style: styles.copyText,
      },
      value?.trim() ||
        `No ${title.toLowerCase()}.`,
    ),
  );
}

function buildDocument(
  invoice: InvoiceDto,
  generatedAt: Date,
): ReactElement {
  const displayNumber =
    invoice.invoiceNumber ??
    "DRAFT";

  const sellerDetails = [
    invoice.sellerEmail,
    invoice.sellerPhone,
    invoice.sellerAddress,
    invoice.sellerTaxId
      ? `Tax / ID: ${invoice.sellerTaxId}`
      : null,
  ];

  const clientDetails = [
    invoice.clientEmail,
    invoice.clientPhone,
    invoice.clientAddress,
    invoice.contactName
      ? `Contact: ${invoice.contactName}`
      : null,
    invoice.contactEmail,
  ];

  const lineRows =
    invoice.lineItems.map(
      (line, index) =>
        h(
          View,
          {
            key: line.id,
            wrap: false,
            style: [
              styles.tableRow,
              ...(index ===
              invoice.lineItems.length -
                1
                ? [styles.tableRowLast]
                : []),
            ],
          },
          h(
            Text,
            {
              style: [
                styles.descriptionColumn,
                styles.lineDescription,
              ],
            },
            line.description,
          ),
          h(
            Text,
            {
              style: [
                styles.qtyColumn,
                styles.lineNumber,
              ],
            },
            quantity(line.quantity),
          ),
          h(
            Text,
            {
              style: [
                styles.unitColumn,
                styles.lineNumber,
              ],
            },
            money(
              invoice.currency,
              line.unitPrice,
            ),
          ),
          h(
            Text,
            {
              style: [
                styles.discountColumn,
                styles.lineNumber,
              ],
            },
            percentage(
              line.discountPercent,
            ),
          ),
          h(
            Text,
            {
              style: [
                styles.taxColumn,
                styles.lineNumber,
              ],
            },
            percentage(
              line.taxPercent,
            ),
          ),
          h(
            Text,
            {
              style: [
                styles.totalColumn,
                styles.lineNumber,
              ],
            },
            money(
              invoice.currency,
              line.total,
            ),
          ),
        ),
    );

  const footerTimestamp =
    generatedAt.toISOString();

  return h(
    Document,
    {
      title:
        invoice.invoiceNumber
          ? `Invoice ${invoice.invoiceNumber}`
          : "Draft invoice",
      author: invoice.sellerName,
      subject:
        `Invoice for ${invoice.clientName}`,
      creator: "ClientFlow",
      producer: "ClientFlow",
      creationDate: generatedAt,
      modificationDate: generatedAt,
      language: "en",
    },
    h(
      Page,
      {
        size: "A4",
        style: styles.page,
        wrap: true,
      },

      h(
        View,
        {
          style: styles.header,
          wrap: false,
        },
        h(
          View,
          {
            style: styles.brandBlock,
          },
          h(
            Text,
            {
              style:
                styles.brandEyebrow,
            },
            "Billing document",
          ),
          h(
            Text,
            {
              style: styles.brandName,
            },
            invoice.sellerName,
          ),
          h(
            Text,
            {
              style: styles.brandMeta,
            },
            [
              invoice.sellerEmail,
              invoice.sellerPhone,
            ]
              .filter(Boolean)
              .join("  |  ") ||
              "Generated securely by ClientFlow",
          ),
        ),

        h(
          View,
          {
            style:
              styles.invoiceHeading,
          },
          h(
            Text,
            {
              style:
                styles.invoiceEyebrow,
            },
            "Invoice",
          ),
          h(
            Text,
            {
              style:
                styles.invoiceNumber,
            },
            displayNumber,
          ),
          h(
            Text,
            {
              style: [
                styles.statusPill,
                ...(invoice.status ===
                  "VOID" ||
                invoice.status ===
                  "OVERDUE"
                  ? [
                      styles.statusDanger,
                    ]
                  : [
                      styles.statusNormal,
                    ]),
              ],
            },
            formatStatus(
              invoice.status,
            ),
          ),
          invoice.status ===
          "DRAFT"
            ? h(
                Text,
                {
                  style:
                    styles.draftNote,
                },
                "No permanent invoice number has been allocated.",
              )
            : null,
        ),
      ),

      invoice.status === "VOID"
        ? h(
            Text,
            {
              style:
                styles.voidBanner,
            },
            "VOID - This invoice remains in history but is no longer active.",
          )
        : null,

      h(
        View,
        {
          style: styles.facts,
          wrap: false,
        },
        fact(
          "Issue date",
          formatDate(
            invoice.issueDate,
          ),
        ),
        fact(
          "Due date",
          formatDate(
            invoice.dueDate,
          ),
        ),
        fact(
          "Currency",
          invoice.currency,
        ),
        fact(
          "Project",
          invoice.project?.name ??
            "None",
          true,
        ),
      ),

      h(
        View,
        {
          style: styles.parties,
          wrap: false,
        },
        partyCard(
          "From",
          invoice.sellerName,
          sellerDetails,
        ),
        partyCard(
          "Bill to",
          invoice.clientName,
          clientDetails,
        ),
      ),

      h(
        View,
        {
          style: styles.section,
        },
        h(
          Text,
          {
            style:
              styles.sectionTitle,
          },
          "Line items",
        ),
        h(
          View,
          {
            style: styles.table,
          },
          h(
            View,
            {
              style:
                styles.tableHeader,
              wrap: false,
            },
            h(
              Text,
              {
                style: [
                  styles.descriptionColumn,
                  styles.tableHeaderText,
                ],
              },
              "Description",
            ),
            h(
              Text,
              {
                style: [
                  styles.qtyColumn,
                  styles.tableHeaderText,
                ],
              },
              "Qty",
            ),
            h(
              Text,
              {
                style: [
                  styles.unitColumn,
                  styles.tableHeaderText,
                ],
              },
              "Unit",
            ),
            h(
              Text,
              {
                style: [
                  styles.discountColumn,
                  styles.tableHeaderText,
                ],
              },
              "Disc.",
            ),
            h(
              Text,
              {
                style: [
                  styles.taxColumn,
                  styles.tableHeaderText,
                ],
              },
              "Tax",
            ),
            h(
              Text,
              {
                style: [
                  styles.totalColumn,
                  styles.tableHeaderText,
                ],
              },
              "Total",
            ),
          ),
          ...lineRows,
        ),
      ),

      h(
        View,
        {
          style: styles.summaryWrap,
          wrap: false,
        },
        h(
          View,
          {
            style: styles.summary,
          },
          summaryRow(
            "Subtotal",
            money(
              invoice.currency,
              invoice.subtotal,
            ),
          ),
          summaryRow(
            "Discount",
            money(
              invoice.currency,
              invoice.discountTotal,
            ),
          ),
          summaryRow(
            "Tax",
            money(
              invoice.currency,
              invoice.taxTotal,
            ),
          ),
          summaryRow(
            "Total",
            money(
              invoice.currency,
              invoice.total,
            ),
            {
              strong: true,
            },
          ),
          summaryRow(
            "Paid",
            money(
              invoice.currency,
              invoice.amountPaid,
            ),
          ),
          summaryRow(
            "Balance due",
            money(
              invoice.currency,
              invoice.balanceDue,
            ),
            {
              strong: true,
              last: true,
            },
          ),
        ),
      ),

      h(
        View,
        {
          style: styles.copyGrid,
        },
        copyCard(
          "Notes",
          invoice.notes,
        ),
        copyCard(
          "Terms",
          invoice.terms,
        ),
      ),

      h(
        View,
        {
          style: styles.footer,
          fixed: true,
        },
        h(
          Text,
          null,
          `ClientFlow record ${invoice.id}`,
        ),
        h(
          Text,
          {
            style:
              styles.footerRight,
            render: ({
              pageNumber,
              totalPages,
            }) =>
              `Generated ${footerTimestamp}  |  Page ${pageNumber} of ${totalPages}`,
          },
        ),
      ),
    ),
  );
}

export async function renderInvoicePdf(
  invoice: InvoiceDto,
): Promise<InvoicePdfResult> {
  const generatedAt = new Date();

  const document =
    buildDocument(
      invoice,
      generatedAt,
    );

  /*
   * @react-pdf/renderer expects exactly
   * ReactElement<DocumentProps>. React 19's createElement()
   * inference loses that root prop type here because this file
   * builds the PDF tree without TSX. The runtime root is still
   * the renderer's Document component, so narrow only at the
   * renderer boundary using its own declared parameter type.
   */
  const buffer =
    await renderToBuffer(
      document as Parameters<
        typeof renderToBuffer
      >[0],
    );

  return {
    buffer,
    contentType:
      "application/pdf",
    filename:
      filenameFor(invoice),
  };
}
