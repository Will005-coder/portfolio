export interface LayoutBlock {
  type: "image" | "video" | "loop" | "text" | "stat";
  col: number;
  span: number;
  // content specific
  src?: string;
  alt?: string;
  body?: string;
  value?: string;
  label?: string;
  aspect?: string;
  fit?: "cover" | "contain";
  frames?: string[];
  trigger?: "scroll" | "hover" | "auto";
  caption?: string;
  autoplay?: string;
  loop?: boolean;
}

export interface RecordData {
  id: string;
  title: string;
  where?: string;
  tags?: string[];
  kind?: string;
  blocks: LayoutBlock[];
}
