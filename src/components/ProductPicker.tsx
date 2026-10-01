import { useMemo } from 'react'
import type { CrmProductOption } from '../api/fillValues'
import { matchesProduct, productLine, productUnit, type Product } from '../data/products'

export { productsFromText } from '../data/products'
import { TableSearchSelectField, Tag, type TableSearchColumn } from '../ui'
import { useLeadFormFillValues } from './useLeadFormFillValues'

/** Fill-values product → the `Product` shape the forms already use (no unit on the server side). */
export function fromCrmProduct(item: CrmProductOption): Product {
  return { id: item.crmProductNo, itemName: item.productName, itemCode: item.code }
}

/**
 * Products for the Product picker: `products` from the lead fill-values API only (empty until they load,
 * or without a Spectrum login).
 */
export function useProductCatalog() {
  const { values } = useLeadFormFillValues()
  const products = useMemo(() => (values ? values.products.map(fromCrmProduct) : []), [values])
  return { remote: values !== null, products }
}

export interface ProductPickerProps {
  catalog: readonly Product[]
  /** Hide the Unit column (server products have no unit). */
  showUnit: boolean
  selected: Product[]
  onChange: (next: Product[]) => void
  label?: string
  required?: boolean
  error?: string
}

/** Multi-select product lookup: pick from the table, selected items show as removable tags. */
export default function ProductPicker({
  catalog,
  showUnit,
  selected,
  onChange,
  label = 'Product',
  required,
  error,
}: ProductPickerProps) {
  const available = catalog.filter((item) => !selected.some((picked) => picked.id === item.id))
  // Server products: name only (the code stays searchable). Demo catalogue: its codes tell near-identical
  // item names apart, so they stay, with the Unit column.
  const columns: TableSearchColumn<Product>[] = showUnit
    ? [
        { header: 'Code - Item Name', getValue: productLine, truncate: true },
        { header: 'Unit', getValue: productUnit, width: '3.5rem' },
      ]
    : [{ header: 'Product', getValue: (item) => item.itemName, truncate: true }]

  return (
    <div>
      <TableSearchSelectField
        label={label}
        required={required}
        error={error}
        options={available}
        value={null}
        onChange={(item) => {
          if (item && !selected.some((picked) => picked.id === item.id)) onChange([...selected, item])
        }}
        getKey={(item) => String(item.id)}
        getLabel={(item) => item.itemName}
        filterItem={matchesProduct}
        placeholder="Search product"
        searchPlaceholder="Search"
        emptyText="No matching products"
        clearable={false}
        columns={columns}
      />
      {selected.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {selected.map((item) => (
            <Tag
              key={item.id}
              label={item.itemName}
              title={item.itemName}
              onRemove={() => onChange(selected.filter((picked) => picked.id !== item.id))}
              removeLabel={`Remove ${item.itemName}`}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}
