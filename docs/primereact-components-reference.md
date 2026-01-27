# PrimeReact Components Reference

Complete reference table of all PrimeReact components with TypeScript usage examples and Pass Through (PT) sections.

**Source**: [PrimeReact Documentation](https://primereact.org/installation/)

> **Note on Pass Through**: 
> - **General Pass Through Guide**: [PrimeReact Pass Through Documentation](https://primereact.org/passthrough/)
> - **Component-Specific PT Sections**: Each component's documentation page has a dedicated "Pass Through" tab/section listing all available PT sections with descriptions. For example, see [Editor Pass Through](https://primereact.org/editor/#passthrough)
> - **Usage**: Use `pt={{ sectionName: { className: '...', style: {...} } }}` to customize DOM elements
> - **Note**: The PT sections listed below are common/typical sections. For the complete and accurate list, refer to each component's documentation page.

## Form Components

| Component | Import | TypeScript Usage Snippet | Pass Through (PT) Sections |
|-----------|--------|--------------------------|----------------------------|
| **AutoComplete** | `import { AutoComplete } from 'primereact/autocomplete';` | `<AutoComplete value={value} suggestions={items} completeMethod={search} onChange={(e) => setValue(e.value)} />` | `root`, `input`, `panel`, `list`, `item`, `emptyMessage`, `loadingIcon`, `dropdown` |
| **Calendar** | `import { Calendar } from 'primereact/calendar';` | `<Calendar value={date} onChange={(e) => setDate(e.value)} />` | `root`, `input`, `panel`, `header`, `previousButton`, `nextButton`, `title`, `monthTitle`, `yearTitle`, `table`, `weekDay`, `day`, `dayLabel`, `week`, `footer`, `todayButton`, `clearButton` |
| **CascadeSelect** | `import { CascadeSelect } from 'primereact/cascadeselect';` | `<CascadeSelect value={selectedCity} onChange={(e) => setSelectedCity(e.value)} options={countries} optionLabel="cname" optionGroupLabel="name" optionGroupChildren="items" />` | `root`, `input`, `panel`, `list`, `item`, `group`, `emptyMessage` |
| **Checkbox** | `import { Checkbox } from 'primereact/checkbox';` | `<Checkbox inputId="cb1" checked={checked} onChange={(e) => setChecked(e.checked ?? false)} />` | `root`, `box`, `input`, `icon` |
| **Chips** | `import { Chips } from 'primereact/chips';` | `<Chips value={value} onChange={(e) => setValue(e.value ?? [])} />` | `root`, `label`, `inputToken`, `token`, `removeTokenIcon` |
| **ColorPicker** | `import { ColorPicker } from 'primereact/colorpicker';` | `<ColorPicker value={color} onChange={(e) => setColor(e.value ?? '')} />` | `root`, `input`, `panel`, `content`, `selector`, `color`, `colorHandle`, `hue`, `hueHandle` |
| **Dropdown** | `import { Dropdown } from 'primereact/dropdown';` | `<Dropdown value={selectedCity} onChange={(e) => setSelectedCity(e.value)} options={cities} optionLabel="name" placeholder="Select a City" />` | `root`, `input`, `trigger`, `panel`, `header`, `filterContainer`, `filterInput`, `filterIcon`, `list`, `item`, `itemGroup`, `emptyMessage`, `clearIcon`, `checkmark`, `loadingIcon` |
| **Editor** | `import { Editor } from 'primereact/editor';` | `<Editor value={text} onTextChange={(e) => setText(e.htmlValue ?? '')} style={{ height: '320px' }} />` | `root`, `toolbar`, `formats`, `select`, `option`, `button`, `content`, `hooks` |
| **FloatLabel** | `import { FloatLabel } from 'primereact/floatlabel';` | `<FloatLabel><InputText id="username" value={value} onChange={(e) => setValue(e.target.value)} /><label htmlFor="username">Username</label></FloatLabel>` | `root`, `label` |
| **IconField** | `import { IconField } from 'primereact/iconfield';` | `<IconField iconPosition="left"><InputIcon className="pi pi-search" /><InputText placeholder="Search" /></IconField>` | `root`, `inputIcon` |
| **InputGroup** | `import { InputGroup } from 'primereact/inputgroup';` | `<InputGroup><InputGroupAddon><i className="pi pi-user" /></InputGroupAddon><InputText placeholder="Username" /></InputGroup>` | `root`, `addon` |
| **InputMask** | `import { InputMask } from 'primereact/inputmask';` | `<InputMask mask="99-999999" value={value} onChange={(e) => setValue(e.value ?? '')} />` | `root`, `input` |
| **InputSwitch** | `import { InputSwitch } from 'primereact/inputswitch';` | `<InputSwitch checked={checked} onChange={(e) => setChecked(e.value ?? false)} />` | `root`, `slider`, `sliderHandle` |
| **InputNumber** | `import { InputNumber } from 'primereact/inputnumber';` | `<InputNumber value={value} onValueChange={(e) => setValue(e.value ?? 0)} />` | `root`, `input`, `buttonGroup`, `incrementButton`, `decrementButton` |
| **InputOtp** | `import { InputOtp } from 'primereact/inputotp';` | `<InputOtp value={value} onChange={(e) => setValue(e.value ?? '')} length={6} />` | `root`, `inputToken`, `input` |
| **InputText** | `import { InputText } from 'primereact/inputtext';` | `<InputText value={value} onChange={(e) => setValue(e.target.value)} />` | `root` |
| **InputTextarea** | `import { InputTextarea } from 'primereact/inputtextarea';` | `<InputTextarea value={value} onChange={(e) => setValue(e.target.value)} rows={5} cols={30} />` | `root` |
| **KeyFilter** | `import { KeyFilter } from 'primereact/keyfilter';` | `<InputText keyfilter="int" placeholder="Integers" />` | N/A (used as prop) |
| **Knob** | `import { Knob } from 'primereact/knob';` | `<Knob value={value} onChange={(e) => setValue(e.value ?? 0)} />` | `root`, `range`, `value`, `label` |
| **Listbox** | `import { Listbox } from 'primereact/listbox';` | `<Listbox value={selectedCity} onChange={(e) => setSelectedCity(e.value)} options={cities} optionLabel="name" />` | `root`, `list`, `item`, `itemGroup`, `emptyMessage`, `header`, `filterContainer`, `filterInput`, `filterIcon` |
| **Mention** | `import { Mention } from 'primereact/mention';` | `<Mention value={value} onChange={(e) => setValue(e.value ?? '')} suggestions={suggestions} trigger="@" />` | `root`, `input`, `panel`, `list`, `item` |
| **MultiSelect** | `import { MultiSelect } from 'primereact/multiselect';` | `<MultiSelect value={selectedCities} onChange={(e) => setSelectedCities(e.value ?? [])} options={cities} optionLabel="name" placeholder="Select Cities" />` | `root`, `labelContainer`, `label`, `token`, `removeTokenIcon`, `trigger`, `panel`, `header`, `filterContainer`, `filterInput`, `filterIcon`, `list`, `item`, `itemGroup`, `emptyMessage`, `checkmark`, `clearIcon`, `loadingIcon` |
| **MultiStateCheckbox** | `import { MultiStateCheckbox } from 'primereact/multistatecheckbox';` | `<MultiStateCheckbox value={value} onChange={(e) => setValue(e.value)} />` | `root`, `box`, `input`, `icon` |
| **Password** | `import { Password } from 'primereact/password';` | `<Password value={value} onChange={(e) => setValue(e.target.value)} feedback={false} />` | `root`, `input`, `showIcon`, `hideIcon`, `panel`, `meter`, `meterLabel`, `info`, `transition` |
| **RadioButton** | `import { RadioButton } from 'primereact/radiobutton';` | `<RadioButton inputId="rb1" name="city" value="Chicago" checked={city === 'Chicago'} onChange={(e) => setCity(e.value)} />` | `root`, `box`, `input`, `icon` |
| **Rating** | `import { Rating } from 'primereact/rating';` | `<Rating value={value} onChange={(e) => setValue(e.value ?? 0)} />` | `root`, `item`, `onIcon`, `offIcon`, `cancelIcon` |
| **SelectButton** | `import { SelectButton } from 'primereact/selectbutton';` | `<SelectButton value={value} onChange={(e) => setValue(e.value)} options={options} />` | `root`, `button`, `label` |
| **Slider** | `import { Slider } from 'primereact/slider';` | `<Slider value={value} onChange={(e) => setValue(e.value ?? 0)} />` | `root`, `range`, `handle`, `startHandler`, `endHandler` |
| **TreeSelect** | `import { TreeSelect } from 'primereact/treeselect';` | `<TreeSelect value={selectedNodeKey} onChange={(e) => setSelectedNodeKey(e.value)} options={nodes} />` | `root`, `labelContainer`, `label`, `trigger`, `panel`, `tree`, `node`, `nodeContent`, `nodeToggler`, `nodeIcon`, `nodeLabel`, `emptyMessage` |
| **TriStateCheckbox** | `import { TriStateCheckbox } from 'primereact/tristatecheckbox';` | `<TriStateCheckbox value={value} onChange={(e) => setValue(e.value)} />` | `root`, `box`, `input`, `icon` |
| **ToggleButton** | `import { ToggleButton } from 'primereact/togglebutton';` | `<ToggleButton checked={checked} onChange={(e) => setChecked(e.value ?? false)} onLabel="Yes" offLabel="No" />` | `root`, `icon`, `label` |

## Button Components

| Component | Import | TypeScript Usage Snippet | Pass Through (PT) Sections |
|-----------|--------|--------------------------|----------------------------|
| **Button** | `import { Button } from 'primereact/button';` | `<Button label="Submit" icon="pi pi-check" onClick={() => {}} />` | `root`, `label`, `icon`, `loadingIcon`, `badge` |
| **SpeedDial** | `import { SpeedDial } from 'primereact/speeddial';` | `<SpeedDial model={items} radius={120} type="circle" direction="up" />` | `root`, `button`, `menu`, `menuButton`, `menuItem`, `menuItemIcon`, `menuItemLabel` |
| **SplitButton** | `import { SplitButton } from 'primereact/splitbutton';` | `<SplitButton label="Save" icon="pi pi-check" onClick={save} model={items} />` | `root`, `button`, `buttonLabel`, `menuButton`, `menu`, `menuItem`, `menuItemIcon`, `menuItemLabel` |

## Data Components

| Component | Import | TypeScript Usage Snippet | Pass Through (PT) Sections |
|-----------|--------|--------------------------|----------------------------|
| **DataTable** | `import { DataTable } from 'primereact/datatable'; import { Column } from 'primereact/column';` | `<DataTable value={products} tableStyle={{ minWidth: '50rem' }}><Column field="code" header="Code" /><Column field="name" header="Name" /></DataTable>` | `root`, `header`, `headerCell`, `columnResizer`, `headerTitle`, `headerContent`, `sortIcon`, `rowGroupHeader`, `rowGroupFooter`, `body`, `row`, `rowExpansion`, `cell`, `footer`, `footerCell`, `emptyMessage`, `loadingOverlay`, `loadingIcon`, `paginator`, `paginatorFirst`, `paginatorPrev`, `paginatorPages`, `paginatorPage`, `paginatorNext`, `paginatorLast`, `paginatorRowsPerPageDropdown`, `paginatorCurrentPageReport`, `paginatorJumpToPageInput` |
| **DataView** | `import { DataView } from 'primereact/dataview';` | `<DataView value={products} layout="grid" itemTemplate={gridItem} />` | `root`, `header`, `content`, `grid`, `emptyMessage`, `loadingOverlay`, `loadingIcon` |
| **DataScroller** | `import { DataScroller } from 'primereact/datascroller';` | `<DataScroller value={cars} itemTemplate={carTemplate} rows={10} />` | `root`, `content`, `loader`, `loadingIcon` |
| **OrderList** | `import { OrderList } from 'primereact/orderlist';` | `<OrderList value={products} header="Products" listStyle={{ height: '250px' }} itemTemplate={itemTemplate} onChange={(e) => setProducts(e.value ?? [])} />` | `root`, `controls`, `container`, `header`, `list`, `item`, `itemContent`, `moveUpButton`, `moveTopButton`, `moveDownButton`, `moveBottomButton` |
| **OrgChart** | `import { OrgChart } from 'primereact/orgchart';` | `<OrgChart value={data} selectionMode="single" selection={selectedNode} onSelectionChange={(e) => setSelectedNode(e.data)} />` | `root`, `table`, `node`, `nodeCell`, `nodeContent`, `nodeLabel`, `nodeToggleIcon`, `connectorLine`, `connectorLineDown`, `connectorLineLeft`, `connectorLineRight` |
| **Paginator** | `import { Paginator } from 'primereact/paginator';` | `<Paginator first={first} rows={rows} totalRecords={120} onPageChange={(e) => { setFirst(e.first); setRows(e.rows); }} />` | `root`, `firstPageButton`, `prevPageButton`, `nextPageButton`, `lastPageButton`, `pages`, `pageButton`, `rowsPerPageDropdown`, `currentPageReport`, `jumpToPageInput` |
| **PickList** | `import { PickList } from 'primereact/picklist';` | `<PickList source={source} target={target} sourceHeader="Available" targetHeader="Selected" itemTemplate={itemTemplate} onChange={(e) => { setSource(e.source); setTarget(e.target); }} />` | `root`, `sourceControls`, `sourceHeader`, `sourceList`, `sourceWrapper`, `targetControls`, `targetHeader`, `targetList`, `targetWrapper`, `item`, `itemContent`, `moveUpButton`, `moveTopButton`, `moveDownButton`, `moveBottomButton`, `moveToTargetButton`, `moveAllToTargetButton`, `moveToSourceButton`, `moveAllToSourceButton` |
| **Tree** | `import { Tree } from 'primereact/tree';` | `<Tree value={nodes} selectionMode="checkbox" selectionKeys={selectedKeys} onSelectionChange={(e) => setSelectedKeys(e.value)} />` | `root`, `container`, `node`, `nodeContent`, `nodeToggler`, `nodeTogglerIcon`, `nodeIcon`, `nodeLabel`, `nodeCheckbox`, `nodeLoadingIcon`, `emptyMessage`, `loadingOverlay`, `loadingIcon` |
| **TreeTable** | `import { TreeTable } from 'primereact/treetable';` | `<TreeTable value={nodes} tableStyle={{ minWidth: '50rem' }}><Column field="name" header="Name" expander /><Column field="size" header="Size" /><Column field="type" header="Type" /></TreeTable>` | `root`, `header`, `headerCell`, `headerTitle`, `headerContent`, `sortIcon`, `body`, `row`, `rowExpansion`, `cell`, `nodeToggler`, `nodeTogglerIcon`, `nodeIcon`, `nodeLabel`, `footer`, `footerCell`, `emptyMessage`, `loadingOverlay`, `loadingIcon` |
| **Timeline** | `import { Timeline } from 'primereact/timeline';` | `<Timeline value={events} content={(item) => item.status} />` | `root`, `event`, `eventMarker`, `eventConnector`, `eventContent` |
| **VirtualScroller** | `import { VirtualScroller } from 'primereact/virtualscroller';` | `<VirtualScroller items={items} itemSize={50} itemTemplate={(item) => <div>{item}</div>} />` | `root`, `content`, `loader`, `loadingIcon`, `spacer` |

## Panel Components

| Component | Import | TypeScript Usage Snippet | Pass Through (PT) Sections |
|-----------|--------|--------------------------|----------------------------|
| **Accordion** | `import { Accordion, AccordionTab } from 'primereact/accordion';` | `<Accordion activeIndex={0}><AccordionTab header="Header I"><p>Content</p></AccordionTab></Accordion>` | `root`, `tab`, `tabHeader`, `tabHeaderAction`, `tabHeaderIcon`, `tabHeaderTitle`, `tabContent`, `tabToggleableContent` |
| **Card** | `import { Card } from 'primereact/card';` | `<Card title="Simple Card"><p>Content</p></Card>` | `root`, `header`, `title`, `subtitle`, `content`, `footer`, `body` |
| **Deferred** | `import { Deferred } from 'primereact/deferred';` | `<Deferred onLoad={() => <HeavyComponent />} />` | `root` |
| **Divider** | `import { Divider } from 'primereact/divider';` | `<Divider />` or `<Divider align="left"><b>Left</b></Divider>` | `root`, `content` |
| **Fieldset** | `import { Fieldset } from 'primereact/fieldset';` | `<Fieldset legend="Header"><p>Content</p></Fieldset>` | `root`, `legend`, `content`, `toggleableIcon` |
| **Panel** | `import { Panel } from 'primereact/panel';` | `<Panel header="Header" toggleable><p>Content</p></Panel>` | `root`, `header`, `title`, `icons`, `toggler`, `togglerIcon`, `content`, `footer` |
| **ScrollPanel** | `import { ScrollPanel } from 'primereact/scrollpanel';` | `<ScrollPanel style={{ width: '100%', height: '200px' }}><div>Content</div></ScrollPanel>` | `root`, `wrapper`, `content` |
| **Splitter** | `import { Splitter, SplitterPanel } from 'primereact/splitter';` | `<Splitter><SplitterPanel size={50}>Panel 1</SplitterPanel><SplitterPanel size={50}>Panel 2</SplitterPanel></Splitter>` | `root`, `panel`, `gutter`, `gutterHandle` |
| **Stepper** | `import { Stepper, StepperPanel } from 'primereact/stepper';` | `<Stepper activeIndex={activeIndex} onStepChange={(e) => setActiveIndex(e.index)}><StepperPanel header="Step 1">Content 1</StepperPanel></Stepper>` | `root`, `panel`, `header`, `headerAction`, `headerNumber`, `headerTitle`, `headerLabel`, `content`, `separator` |
| **TabView** | `import { TabView, TabPanel } from 'primereact/tabview';` | `<TabView activeIndex={activeIndex} onTabChange={(e) => setActiveIndex(e.index)}><TabPanel header="Header I">Content I</TabPanel></TabView>` | `root`, `nav`, `navContainer`, `inkbar`, `panelContainer`, `panel`, `header`, `headerAction`, `headerIcon`, `headerTitle`, `headerLabel`, `content` |
| **Toolbar** | `import { Toolbar } from 'primereact/toolbar';` | `<Toolbar left={leftContent} right={rightContent} />` | `root`, `start`, `center`, `end` |

## Overlay Components

| Component | Import | TypeScript Usage Snippet | Pass Through (PT) Sections |
|-----------|--------|--------------------------|----------------------------|
| **ConfirmDialog** | `import { ConfirmDialog } from 'primereact/confirmdialog';` | `<ConfirmDialog />` (used with `confirm.require()` from `useRef`) | `root`, `mask`, `message`, `icon`, `messageText`, `footer`, `rejectButton`, `acceptButton`, `transition` |
| **ConfirmPopup** | `import { ConfirmPopup } from 'primereact/confirmpopup';` | `<ConfirmPopup />` (used with `confirm.require()` from `useRef`) | `root`, `message`, `icon`, `messageText`, `footer`, `rejectButton`, `acceptButton`, `transition` |
| **Dialog** | `import { Dialog } from 'primereact/dialog';` | `<Dialog header="Header" visible={visible} style={{ width: '50vw' }} onHide={() => setVisible(false)}><p>Content</p></Dialog>` | `root`, `mask`, `header`, `headerTitle`, `headerIcons`, `headerIcon`, `closeButton`, `closeButtonIcon`, `content`, `footer`, `maximizeIcon`, `minimizeIcon`, `transition` |
| **OverlayPanel** | `import { OverlayPanel } from 'primereact/overlaypanel';` | `<OverlayPanel ref={op}><p>Content</p></OverlayPanel>` (triggered with `op.current?.toggle(e)`) | `root`, `content`, `closeButton`, `closeButtonIcon`, `transition` |
| **Sidebar** | `import { Sidebar } from 'primereact/sidebar';` | `<Sidebar visible={visible} onHide={() => setVisible(false)}><p>Content</p></Sidebar>` | `root`, `mask`, `header`, `headerContent`, `headerTitle`, `headerIcons`, `headerIcon`, `closeButton`, `closeButtonIcon`, `content`, `footer`, `transition` |
| **Tooltip** | `import { Tooltip } from 'primereact/tooltip';` | `<Tooltip target=".p-button" />` (used with `data-pr-tooltip="Tooltip text"`) | `root`, `text`, `arrow` |

## File Components

| Component | Import | TypeScript Usage Snippet | Pass Through (PT) Sections |
|-----------|--------|--------------------------|----------------------------|
| **Upload** | `import { FileUpload } from 'primereact/fileupload';` | `<FileUpload mode="basic" name="demo[]" url="/api/upload" accept="image/*" maxFileSize={1000000} onUpload={onUpload} />` | `root`, `input`, `button`, `buttonLabel`, `buttonIcon`, `chooseButton`, `chooseIcon`, `chooseLabel`, `uploadButton`, `uploadIcon`, `uploadLabel`, `cancelButton`, `cancelIcon`, `cancelLabel`, `bar`, `file`, `fileName`, `fileSize`, `removeButton`, `removeIcon`, `progressBar`, `progressBarValue`, `progressBarLabel`, `emptyList`, `list`, `item`, `itemContent`, `itemImage`, `itemThumbnail`, `itemDetails`, `itemName`, `itemSize`, `itemRemove`, `itemRemoveIcon` |

## Menu Components

| Component | Import | TypeScript Usage Snippet | Pass Through (PT) Sections |
|-----------|--------|--------------------------|----------------------------|
| **Breadcrumb** | `import { Breadcrumb } from 'primereact/breadcrumb';` | `<Breadcrumb model={items} home={home} />` | `root`, `list`, `item`, `itemContent`, `itemLink`, `itemIcon`, `itemLabel`, `separator`, `home`, `homeIcon`, `homeLabel` |
| **ContextMenu** | `import { ContextMenu } from 'primereact/contextmenu';` | `<ContextMenu model={items} ref={cm} />` (triggered with `cm.current?.show(e)`) | `root`, `list`, `item`, `itemContent`, `itemLink`, `itemIcon`, `itemLabel`, `submenu`, `submenuIcon`, `separator`, `transition` |
| **Dock** | `import { Dock } from 'primereact/dock';` | `<Dock model={items} position="bottom" />` | `root`, `container`, `menu`, `menuItem`, `menuItemAction`, `menuItemIcon`, `submenu`, `transition` |
| **MegaMenu** | `import { MegaMenu } from 'primereact/megamenu';` | `<MegaMenu model={items} />` | `root`, `list`, `item`, `itemContent`, `itemLink`, `itemIcon`, `itemLabel`, `submenu`, `submenuHeader`, `submenuIcon`, `panel`, `grid`, `column`, `separator`, `transition` |
| **Menu** | `import { Menu } from 'primereact/menu';` | `<Menu model={items} />` | `root`, `list`, `item`, `itemContent`, `itemLink`, `itemIcon`, `itemLabel`, `submenu`, `submenuIcon`, `separator`, `transition` |
| **Menubar** | `import { Menubar } from 'primereact/menubar';` | `<Menubar model={items} />` | `root`, `list`, `item`, `itemContent`, `itemLink`, `itemIcon`, `itemLabel`, `submenu`, `submenuIcon`, `separator`, `start`, `end`, `transition` |
| **PanelMenu** | `import { PanelMenu } from 'primereact/panelmenu';` | `<PanelMenu model={items} />` | `root`, `panel`, `header`, `headerContent`, `headerAction`, `headerIcon`, `headerLabel`, `headerSubmenuIcon`, `toggleableContent`, `menuContent`, `menuList`, `menuItem`, `menuItemContent`, `menuItemLink`, `menuItemIcon`, `menuItemLabel`, `submenu`, `submenuIcon`, `separator` |
| **Steps** | `import { Steps } from 'primereact/steps';` | `<Steps model={items} activeIndex={activeIndex} onSelect={(e) => setActiveIndex(e.index)} />` | `root`, `menu`, `menuitem`, `action`, `stepNumber`, `label`, `separator` |
| **TabMenu** | `import { TabMenu } from 'primereact/tabmenu';` | `<TabMenu model={items} activeIndex={activeIndex} onTabChange={(e) => setActiveIndex(e.index)} />` | `root`, `list`, `item`, `itemAction`, `itemIcon`, `itemLabel`, `inkbar`, `transition` |
| **TieredMenu** | `import { TieredMenu } from 'primereact/tieredmenu';` | `<TieredMenu model={items} popup ref={menu} />` (triggered with `menu.current?.toggle(e)`) | `root`, `list`, `item`, `itemContent`, `itemLink`, `itemIcon`, `itemLabel`, `submenu`, `submenuIcon`, `separator`, `transition` |

## Chart Components

| Component | Import | TypeScript Usage Snippet | Pass Through (PT) Sections |
|-----------|--------|--------------------------|----------------------------|
| **Chart** | `import { Chart } from 'primereact/chart';` | `<Chart type="bar" data={chartData} options={chartOptions} />` | `root`, `canvas` |

## Messages Components

| Component | Import | TypeScript Usage Snippet | Pass Through (PT) Sections |
|-----------|--------|--------------------------|----------------------------|
| **Message** | `import { Message } from 'primereact/message';` | `<Message severity="success" text="Success Message" />` | `root`, `icon`, `text`, `closeButton`, `closeButtonIcon`, `transition` |
| **Messages** | `import { Messages } from 'primereact/messages';` | `<Messages ref={msgs} />` (used with `msgs.current?.show({ severity: 'success', summary: 'Success', detail: 'Message' })`) | `root`, `message`, `messageIcon`, `messageText`, `messageSummary`, `messageDetail`, `closeButton`, `closeButtonIcon`, `transition` |
| **Toast** | `import { Toast } from 'primereact/toast';` | `<Toast ref={toast} />` (used with `toast.current?.show({ severity: 'success', summary: 'Success', detail: 'Message' })`) | `root`, `message`, `messageIcon`, `messageText`, `messageSummary`, `messageDetail`, `closeButton`, `closeButtonIcon`, `transition` |

## Media Components

| Component | Import | TypeScript Usage Snippet | Pass Through (PT) Sections |
|-----------|--------|--------------------------|----------------------------|
| **Carousel** | `import { Carousel } from 'primereact/carousel';` | `<Carousel value={products} numVisible={3} numScroll={3} itemTemplate={productTemplate} />` | `root`, `header`, `content`, `container`, `previousButton`, `previousButtonIcon`, `itemsContainer`, `item`, `itemCloned`, `nextButton`, `nextButtonIcon`, `indicators`, `indicator`, `indicatorButton`, `transition` |
| **Galleria** | `import { Galleria } from 'primereact/galleria';` | `<Galleria value={images} numVisible={5} item={itemTemplate} thumbnail={thumbnailTemplate} />` | `root`, `header`, `content`, `closeButton`, `closeButtonIcon`, `previousItemButton`, `previousItemButtonIcon`, `nextItemButton`, `nextItemButtonIcon`, `itemWrapper`, `itemContainer`, `item`, `itemCaption`, `thumbnailWrapper`, `thumbnailContainer`, `thumbnailItemsContainer`, `thumbnailItem`, `thumbnailItemContent`, `thumbnailItemMask`, `indicator`, `indicatorButton`, `transition` |
| **Image** | `import { Image } from 'primereact/image';` | `<Image src="/images/galleria/galleria1.jpg" alt="Image" width="250" preview />` | `root`, `image`, `button`, `buttonIcon`, `previewContainer`, `preview`, `previewHeader`, `previewHeaderActions`, `previewHeaderAction`, `previewHeaderActionIcon`, `previewHeaderTitle`, `previewContent`, `previewFooter`, `previewFooterActions`, `previewFooterAction`, `previewFooterActionIcon`, `mask`, `transition` |

## Misc Components

| Component | Import | TypeScript Usage Snippet | Pass Through (PT) Sections |
|-----------|--------|--------------------------|----------------------------|
| **Avatar** | `import { Avatar } from 'primereact/avatar';` | `<Avatar label="P" shape="circle" />` or `<Avatar image="/images/avatar.png" shape="circle" />` | `root`, `label`, `icon`, `image` |
| **Badge** | `import { Badge } from 'primereact/badge';` | `<Badge value="2" />` or `<Badge value="2" severity="success" />` | `root`, `value` |
| **BlockUI** | `import { BlockUI } from 'primereact/blockui';` | `<BlockUI blocked={blocked} template={<i className="pi pi-spin pi-spinner" style={{ fontSize: '3rem' }}></i>}><div>Content</div></BlockUI>` | `root`, `mask`, `transition` |
| **Chip** | `import { Chip } from 'primereact/chip';` | `<Chip label="Action" />` or `<Chip label="Action" removable onRemove={() => {}} />` | `root`, `label`, `removeIcon`, `icon` |
| **Inplace** | `import { Inplace, InplaceDisplay, InplaceContent } from 'primereact/inplace';` | `<Inplace><InplaceDisplay>Click to Edit</InplaceDisplay><InplaceContent><InputText value={value} onChange={(e) => setValue(e.target.value)} /></InplaceContent></Inplace>` | `root`, `display`, `displayText`, `content` |
| **MeterGroup** | `import { MeterGroup } from 'primereact/metergroup';` | `<MeterGroup values={values} />` | `root`, `meter`, `meterLabel`, `meterBar`, `meterBarValue`, `meterBarLabel` |
| **ScrollTop** | `import { ScrollTop } from 'primereact/scrolltop';` | `<ScrollTop target="parent" threshold={100} icon="pi pi-arrow-up" />` | `root`, `icon`, `transition` |
| **Skeleton** | `import { Skeleton } from 'primereact/skeleton';` | `<Skeleton />` or `<Skeleton width="10rem" height="2rem" />` | `root` |
| **ProgressBar** | `import { ProgressBar } from 'primereact/progressbar';` | `<ProgressBar value={value} />` | `root`, `value`, `label` |
| **ProgressSpinner** | `import { ProgressSpinner } from 'primereact/progressspinner';` | `<ProgressSpinner />` or `<ProgressSpinner strokeWidth="4" />` | `root`, `spinner`, `circle` |
| **Ripple** | `import { Ripple } from 'primereact/ripple';` | `<div className="p-ripple"><Ripple /></div>` | `root` |
| **StyleClass** | `import { StyleClass } from 'primereact/styleclass';` | `<StyleClass nodeRef={menuRef} selector="@next" enterClassName="hidden" enterActiveClassName="slidedown" leaveActiveClassName="slideup" leaveToClassName="hidden"><Button label="Toggle" /></StyleClass>` | N/A (utility component) |
| **Tag** | `import { Tag } from 'primereact/tag';` | `<Tag value="New" />` or `<Tag value="New" severity="success" />` | `root`, `value`, `icon` |
| **Terminal** | `import { Terminal } from 'primereact/terminal';` | `<Terminal welcomeMessage="Welcome to PrimeReact" prompt="primereact $" />` | `root`, `content`, `prompt`, `command`, `commandText`, `response` |

## Notes

- All components support TypeScript with full type definitions
- Most form components use controlled pattern with `value` and `onChange`/`onValueChange` props
- Event handlers typically receive an event object with `e.value` or `e.target.value`
- Many components support `disabled`, `invalid`, and `variant` (filled/outlined) props
- Components can be imported individually for tree-shaking optimization
- **Pass Through (PT)**: 
  - General guide: [PrimeReact Pass Through](https://primereact.org/passthrough/)
  - Each component's documentation page has a dedicated "Pass Through" tab listing all available PT sections with descriptions
  - Use `pt={{ sectionName: { className: '...', style: {...} } }}` to customize DOM elements
  - PT supports functions that receive component state: `pt={{ header: ({ state }) => ({ className: state.collapsed ? 'collapsed' : '' }) }}`
  - PT sections listed in this reference are common/typical - see each component's page for the complete list
- Refer to [PrimeReact Documentation](https://primereact.org/) for complete API reference, advanced usage, and full Pass Through documentation

## Component Count

- **Form Components**: 31
- **Button Components**: 3
- **Data Components**: 11
- **Panel Components**: 11
- **Overlay Components**: 6
- **File Components**: 1
- **Menu Components**: 10
- **Chart Components**: 1
- **Messages Components**: 3
- **Media Components**: 3
- **Misc Components**: 14

**Total: 84+ Components**
