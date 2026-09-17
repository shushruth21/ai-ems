// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { createDataTableColumns, DataTable } from "../src/components/data/data-table";
import { TooltipProvider } from "../src/components/ui/tooltip";

interface Item {
  id: string;
  name: string;
  qty: number;
}

const col = createDataTableColumns<Item>();
const columns = col.columns([
  col.accessor("name", { header: "Name", meta: { label: "Name" } }),
  col.accessor("qty", {
    header: "Qty",
    enableGlobalFilter: false,
    meta: { label: "Quantity", align: "end" },
  }),
]);

const data: Item[] = Array.from({ length: 30 }, (_, i) => ({
  id: `i${i + 1}`,
  name: `Item ${String(i + 1).padStart(2, "0")}${i % 10 === 0 ? " oak" : ""}`,
  qty: (i * 7) % 13,
}));

function setup(props: Partial<React.ComponentProps<typeof DataTable<Item>>> = {}) {
  const user = userEvent.setup();
  render(
    <TooltipProvider>
      <DataTable
        label="Items"
        columns={columns}
        data={data}
        getRowId={(r) => r.id}
        pageSize={10}
        {...props}
      />
    </TooltipProvider>,
  );
  const table = screen.getByRole("table", { name: "Items" });
  const bodyRows = () => within(table).getAllByRole("row").slice(1);
  return { user, table, bodyRows };
}

describe("DataTable", () => {
  it("paginates", async () => {
    const { user, bodyRows } = setup();
    expect(bodyRows()).toHaveLength(10);
    expect(screen.getByText("1–10 of 30")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous page" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Next page" }));
    expect(screen.getByText("11–20 of 30")).toBeInTheDocument();
    expect(bodyRows()[0]).toHaveTextContent("Item 11");
    await user.click(screen.getByRole("button", { name: "Last page" }));
    expect(screen.getByText("21–30 of 30")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();
  });

  it("sorts with aria-sort", async () => {
    const { user, table, bodyRows } = setup();
    const header = within(table).getByRole("columnheader", { name: /Name/ });
    await user.click(within(header).getByRole("button"));
    expect(header).toHaveAttribute("aria-sort", "ascending");
    expect(bodyRows()[0]).toHaveTextContent("Item 01");
    await user.click(within(header).getByRole("button"));
    expect(header).toHaveAttribute("aria-sort", "descending");
    expect(bodyRows()[0]).toHaveTextContent("Item 30");
  });

  it("searches and offers to clear an empty result", async () => {
    const { user, bodyRows } = setup();
    const search = screen.getByRole("searchbox", { name: "Search table" });
    await user.type(search, "oak");
    expect(bodyRows()).toHaveLength(3);
    expect(screen.getByText("1–3 of 3")).toBeInTheDocument();
    await user.clear(search);
    await user.type(search, "walnut");
    expect(screen.getByText("No matching results")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear search" }));
    expect(bodyRows()).toHaveLength(10);
  });

  it("selects rows and exposes bulk actions", async () => {
    const onBulk = vi.fn();
    const { user } = setup({
      enableSelection: true,
      renderBulkActions: (rows, clear) => (
        <button
          type="button"
          onClick={() => {
            onBulk(rows.map((r) => r.id));
            clear();
          }}
        >
          Archive
        </button>
      ),
    });
    const boxes = screen.getAllByRole("checkbox", { name: "Select row" });
    await user.click(boxes[0]!);
    await user.click(boxes[2]!);
    expect(screen.getByText("2 selected")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Archive" }));
    expect(onBulk).toHaveBeenCalledWith(["i1", "i3"]);
    expect(screen.queryByText("2 selected")).not.toBeInTheDocument();

    await user.click(screen.getByRole("checkbox", { name: "Select all rows on this page" }));
    expect(screen.getByText("10 selected")).toBeInTheDocument();
  });

  it("activates rows by click and keyboard", async () => {
    const onRowClick = vi.fn();
    const { user, bodyRows } = setup({ onRowClick });
    await user.click(bodyRows()[1]!);
    expect(onRowClick).toHaveBeenLastCalledWith(data[1]);
    bodyRows()[2]!.focus();
    await user.keyboard("{Enter}");
    expect(onRowClick).toHaveBeenLastCalledWith(data[2]);
  });

  it("shows skeletons while loading and an empty state with no data", () => {
    const { unmount } = render(
      <TooltipProvider>
        <DataTable label="Loading" columns={columns} data={[]} getRowId={(r) => r.id} loading />
      </TooltipProvider>,
    );
    expect(screen.getByRole("table", { name: "Loading" })).toHaveAttribute("aria-busy", "true");
    unmount();
    render(
      <TooltipProvider>
        <DataTable
          label="Empty"
          columns={columns}
          data={[]}
          getRowId={(r) => r.id}
          emptyState={<p>Nothing here</p>}
        />
      </TooltipProvider>,
    );
    expect(screen.getByText("Nothing here")).toBeInTheDocument();
    expect(screen.getByText("0 results")).toBeInTheDocument();
  });

  it("hides columns from the visibility menu", async () => {
    const { user, table } = setup();
    screen.getByRole("button", { name: "Columns" }).focus();
    await user.keyboard("{Enter}");
    await user.click(await screen.findByRole("menuitemcheckbox", { name: "Quantity" }));
    expect(within(table).queryByRole("columnheader", { name: /Qty/ })).not.toBeInTheDocument();
  });
});
