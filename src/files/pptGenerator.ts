import pptxgen from 'pptxgenjs';

export interface GeneratePptxOptions {
  title: string;
  slides: Array<{ heading: string; bullets: string[] }>;
  outputPath: string;
}

const BACKGROUND_COLOR = '1A1A2E';
const TEXT_COLOR = 'FFFFFF';
const ACCENT_COLOR = '4ECCA3';

export async function generatePptx({
  title,
  slides,
  outputPath,
}: GeneratePptxOptions): Promise<string> {
  const presentation = new pptxgen();
  presentation.layout = 'LAYOUT_WIDE';
  presentation.author = 'Aude AI';
  presentation.company = 'Aude AI';
  presentation.subject = title;
  presentation.title = title;

  const titleSlide = presentation.addSlide();
  titleSlide.background = { color: BACKGROUND_COLOR };
  titleSlide.addText(title, {
    x: 0.75,
    y: 2.15,
    w: 11.83,
    h: 1.2,
    align: 'center',
    valign: 'middle',
    fontFace: 'Aptos',
    fontSize: 26,
    bold: true,
    color: TEXT_COLOR,
  });
  titleSlide.addShape(presentation.ShapeType.line, {
    x: 4.6,
    y: 3.55,
    w: 4.1,
    h: 0,
    line: {
      color: ACCENT_COLOR,
      pt: 1.5,
    },
  });

  for (const content of slides) {
    const slide = presentation.addSlide();
    slide.background = { color: BACKGROUND_COLOR };

    slide.addText(content.heading, {
      x: 0.7,
      y: 0.5,
      w: 11.8,
      h: 0.6,
      fontFace: 'Aptos',
      fontSize: 22,
      bold: true,
      color: ACCENT_COLOR,
    });

    slide.addShape(presentation.ShapeType.line, {
      x: 0.7,
      y: 1.2,
      w: 2.4,
      h: 0,
      line: {
        color: ACCENT_COLOR,
        pt: 1.2,
      },
    });

    const bulletText = content.bullets.length > 0 ? content.bullets.join('\n') : 'No content.';
    slide.addText(bulletText, {
      x: 1,
      y: 1.6,
      w: 11.2,
      h: 4.8,
      fontFace: 'Aptos',
      fontSize: 18,
      color: TEXT_COLOR,
      breakLine: false,
      bullet: { indent: 16 },
      margin: 0.05,
      paraSpaceAfter: 10,
      valign: 'top',
    });
  }

  await presentation.writeFile({ fileName: outputPath });
  return outputPath;
}
