"""
Модуль для постобработки HTML, импортированного из Word документов.
Обеспечивает сохранение стилей и конвертацию в компоненты Bootstrap.
"""
from bs4 import BeautifulSoup
import re


class WordImportProcessor:
    """
    Класс для обработки HTML контента, импортированного из Word.
    Сохраняет стили и конвертирует элементы в компоненты Bootstrap.
    """
    
    def process_html(self, html_content: str) -> str:
        """
        Основной метод обработки HTML.
        
        Args:
            html_content: HTML контент из Pandoc или Mammoth
            
        Returns:
            Обработанный HTML с Bootstrap классами и сохраненными стилями
        """
        if not html_content or not html_content.strip():
            return html_content
        
        # Парсим HTML
        soup = BeautifulSoup(html_content, 'html.parser')
        
        # Извлекаем и сохраняем стили
        self._extract_and_preserve_styles(soup)
        
        # Конвертируем элементы в Bootstrap компоненты
        self._convert_tables_to_bootstrap(soup)
        self._convert_images(soup)
        self._convert_headings(soup)
        self._convert_lists(soup)
        self._convert_text_formatting(soup)
        self._convert_paragraphs(soup)
        self._convert_blocks_to_cards(soup)
        
        # Сохраняем цвета текста из CSS классов в inline стили
        self._preserve_text_colors(soup)
        
        self._wrap_import_content(soup)
        
        return str(soup)
    
    def _wrap_import_content(self, soup):
        """
        Оборачивает импортированный контент в один корневой блок внутри body,
        чтобы в редакторе и на странице статьи блок можно было выделять и стилизовать целиком.
        """
        body = soup.find('body')
        if body:
            wrapper = soup.new_tag('div', **{'class': 'wiki-word-import'})
            for child in list(body.children):
                wrapper.append(child.extract())
            body.append(wrapper)
            return
        html_el = soup.find('html')
        if html_el:
            wrapper = soup.new_tag('div', **{'class': 'wiki-word-import'})
            for child in list(html_el.children):
                if getattr(child, 'name', None) == 'head':
                    continue
                wrapper.append(child.extract())
            body_tag = soup.new_tag('body')
            body_tag.append(wrapper)
            html_el.append(body_tag)
            return
        wrapper = soup.new_tag('div', **{'class': 'wiki-word-import'})
        for child in list(soup.contents):
            wrapper.append(child.extract())
        soup.append(wrapper)
    
    def _extract_and_preserve_styles(self, soup):
        """
        Извлекает и сохраняет стили из <style> блоков.
        Стили сохраняются в документе для последующего использования.
        """
        # Находим все style блоки
        style_tags = soup.find_all('style')
        
        # Сохраняем стили в атрибуте data-styles для возможного использования
        # или оставляем их в документе (они будут сохранены автоматически)
        for style_tag in style_tags:
            # Убеждаемся, что стили не удаляются
            # BeautifulSoup сохранит их автоматически
            pass
    
    def _convert_tables_to_bootstrap(self, soup):
        """
        Конвертирует таблицы в Bootstrap таблицы с сохранением стилей.
        """
        for table in soup.find_all('table'):
            # Добавить базовые классы Bootstrap
            table_classes = ['table', 'table-bordered']
            
            # Проверить наличие чередующихся строк
            if self._has_striped_rows(table):
                table_classes.append('table-striped')
            
            # Проверить наличие hover эффекта (если есть стили :hover в inline)
            # Для простоты добавляем table-hover, если есть интерактивность
            
            # Сохранить существующие классы
            existing_classes = table.get('class', [])
            if isinstance(existing_classes, str):
                existing_classes = existing_classes.split()
            elif existing_classes is None:
                existing_classes = []
            
            # Объединить классы, избегая дубликатов
            all_classes = list(set(existing_classes + table_classes))
            table['class'] = all_classes
            
            # Обработать thead, tbody, tfoot
            for thead in table.find_all('thead'):
                thead_classes = thead.get('class', [])
                if isinstance(thead_classes, str):
                    thead_classes = thead_classes.split()
                elif thead_classes is None:
                    thead_classes = []
                if 'table-dark' not in thead_classes:
                    # Можно добавить table-dark для заголовков, но не делаем автоматически
                    pass
            
            # Сохранить inline стили для ячеек (цвета, границы, размер шрифта, шрифт и т.д.)
            for cell in table.find_all(['td', 'th']):
                # Сохраняем все inline стили ячейки
                cell_style = cell.get('style', '')
                style_dict = self._parse_style_string(cell_style)
                
                # Обрабатываем содержимое ячейки - ищем span, p и другие элементы с текстом
                self._preserve_cell_text_styles(cell)
                
                # Добавляем классы для выравнивания, если есть inline стили
                if style_dict:
                    if 'text-align' in style_dict:
                        align_value = style_dict['text-align'].lower()
                        cell_classes = cell.get('class', [])
                        if isinstance(cell_classes, str):
                            cell_classes = cell_classes.split()
                        elif cell_classes is None:
                            cell_classes = []
                        
                        if align_value == 'center' and 'text-center' not in cell_classes:
                            cell_classes.append('text-center')
                        elif align_value == 'right' and 'text-end' not in cell_classes:
                            cell_classes.append('text-end')
                        elif align_value == 'left' and 'text-start' not in cell_classes:
                            cell_classes.append('text-start')
                        
                        if cell_classes:
                            cell['class'] = cell_classes
                    
                    # Сохраняем все стили ячейки (фон, границы и т.д.)
                    style_string = '; '.join([f'{k}: {v}' for k, v in style_dict.items()])
                    cell['style'] = style_string
                elif cell_style:
                    # Если были стили, но они не попали в словарь, сохраняем как есть
                    cell['style'] = cell_style
    
    def _has_striped_rows(self, table):
        """
        Проверяет, есть ли чередующиеся строки в таблице.
        """
        rows = table.find_all('tr')
        if len(rows) < 2:
            return False
        
        # Проверяем наличие разных стилей фона у соседних строк
        backgrounds = []
        for row in rows:
            style = row.get('style', '')
            bg_match = re.search(r'background(?:-color)?:\s*([^;]+)', style, re.IGNORECASE)
            if bg_match:
                backgrounds.append(bg_match.group(1).strip())
            else:
                backgrounds.append(None)
        
        # Если есть чередование фонов, считаем что есть striped
        if len(backgrounds) >= 2:
            unique_backgrounds = set(bg for bg in backgrounds if bg is not None)
            if len(unique_backgrounds) >= 2:
                return True
        
        return False
    
    def _convert_images(self, soup):
        """
        Конвертирует изображения в адаптивные Bootstrap изображения.
        """
        for img in soup.find_all('img'):
            # Добавить класс для адаптивности
            img_classes = ['img-fluid']
            
            existing_classes = img.get('class', [])
            if isinstance(existing_classes, str):
                existing_classes = existing_classes.split()
            elif existing_classes is None:
                existing_classes = []
            
            # Объединить классы
            all_classes = list(set(existing_classes + img_classes))
            img['class'] = all_classes
            
            # Обработать обертки изображений для выравнивания
            parent = img.parent
            if parent and parent.name in ['p', 'div']:
                parent_style = parent.get('style', '')
                if 'text-align: center' in parent_style or 'text-align:center' in parent_style:
                    parent_classes = parent.get('class', [])
                    if isinstance(parent_classes, str):
                        parent_classes = parent_classes.split()
                    elif parent_classes is None:
                        parent_classes = []
                    if 'text-center' not in parent_classes:
                        parent_classes.append('text-center')
                        parent['class'] = parent_classes
                elif 'text-align: right' in parent_style or 'text-align:right' in parent_style:
                    parent_classes = parent.get('class', [])
                    if isinstance(parent_classes, str):
                        parent_classes = parent_classes.split()
                    elif parent_classes is None:
                        parent_classes = []
                    if 'text-end' not in parent_classes:
                        parent_classes.append('text-end')
                        parent['class'] = parent_classes
    
    def _convert_headings(self, soup):
        """
        Обрабатывает заголовки, добавляя Bootstrap классы для отступов.
        """
        for heading in soup.find_all(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']):
            heading_classes = ['mb-3']
            
            existing_classes = heading.get('class', [])
            if isinstance(existing_classes, str):
                existing_classes = existing_classes.split()
            elif existing_classes is None:
                existing_classes = []
            
            # Добавить отступ сверху для заголовков (кроме первого)
            if heading.find_previous(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'div']):
                heading_classes.append('mt-4')
            
            # Объединить классы
            all_classes = list(set(existing_classes + heading_classes))
            heading['class'] = all_classes
            
            # Обработать выравнивание
            style = heading.get('style', '')
            if style:
                if 'text-align: center' in style or 'text-align:center' in style:
                    if 'text-center' not in all_classes:
                        all_classes.append('text-center')
                        heading['class'] = all_classes
                elif 'text-align: right' in style or 'text-align:right' in style:
                    if 'text-end' not in all_classes:
                        all_classes.append('text-end')
                        heading['class'] = all_classes
                elif 'text-align: justify' in style or 'text-align:justify' in style:
                    if 'text-justify' not in all_classes:
                        all_classes.append('text-justify')
                        heading['class'] = all_classes
    
    def _convert_lists(self, soup):
        """
        Обрабатывает списки, добавляя Bootstrap классы.
        """
        for list_elem in soup.find_all(['ul', 'ol']):
            list_classes = ['mb-3']
            
            existing_classes = list_elem.get('class', [])
            if isinstance(existing_classes, str):
                existing_classes = existing_classes.split()
            elif existing_classes is None:
                existing_classes = []
            
            # Объединить классы
            all_classes = list(set(existing_classes + list_classes))
            list_elem['class'] = all_classes
            
            # Обработать вложенные списки
            for nested_list in list_elem.find_all(['ul', 'ol'], recursive=False):
                nested_classes = nested_list.get('class', [])
                if isinstance(nested_classes, str):
                    nested_classes = nested_classes.split()
                elif nested_classes is None:
                    nested_classes = []
                if 'ms-3' not in nested_classes:
                    nested_classes.append('ms-3')
                    nested_list['class'] = nested_classes
    
    def _convert_text_formatting(self, soup):
        """
        Обрабатывает текстовое форматирование, сохраняя стили.
        """
        # Обработать выравнивание в параграфах и div
        for elem in soup.find_all(['p', 'div']):
            style = elem.get('style', '')
            if style:
                elem_classes = elem.get('class', [])
                if isinstance(elem_classes, str):
                    elem_classes = elem_classes.split()
                elif elem_classes is None:
                    elem_classes = []
                
                # Выравнивание
                if 'text-align: center' in style or 'text-align:center' in style:
                    if 'text-center' not in elem_classes:
                        elem_classes.append('text-center')
                elif 'text-align: right' in style or 'text-align:right' in style:
                    if 'text-end' not in elem_classes:
                        elem_classes.append('text-end')
                elif 'text-align: justify' in style or 'text-align:justify' in style:
                    if 'text-justify' not in elem_classes:
                        elem_classes.append('text-justify')
                
                if elem_classes:
                    elem['class'] = elem_classes
        
        # Сохранить все inline стили для span и других элементов
        # BeautifulSoup сохранит их автоматически
    
    def _preserve_text_colors(self, soup):
        """
        Сохраняет цвета текста из CSS классов и стилей в inline стили.
        Обрабатывает все элементы, которые могут содержать текст с цветом.
        """
        # Извлекаем все CSS правила из style тегов
        css_rules = {}
        for style_tag in soup.find_all('style'):
            css_text = style_tag.string if style_tag.string else ''
            # Парсим CSS правила - ищем правила с color
            # Поддерживаем различные форматы: .class { color: ...; }, span { color: ...; } и т.д.
            # Ищем селекторы классов (более гибкий паттерн)
            class_pattern = r'\.([\w-]+)\s*\{[^}]*color\s*:\s*([^;]+)[^}]*\}'
            matches = re.findall(class_pattern, css_text, re.IGNORECASE)
            for class_name, color_value in matches:
                css_rules[class_name] = color_value.strip()
            
            # Ищем селекторы тегов
            tag_pattern = r'(span|p|div|h[1-6]|strong|em|b|i|u|td|th|li|a)\s*\{[^}]*color\s*:\s*([^;]+)[^}]*\}'
            tag_matches = re.findall(tag_pattern, css_text, re.IGNORECASE)
            for tag_name, color_value in tag_matches:
                css_rules[f'tag:{tag_name}'] = color_value.strip()
            
            # Ищем селекторы с атрибутами [style-name="..."]
            attr_pattern = r'\[style-name=["\']([^"\']+)["\']\]\s*\{[^}]*color\s*:\s*([^;]+)[^}]*\}'
            attr_matches = re.findall(attr_pattern, css_text, re.IGNORECASE)
            for style_name, color_value in attr_matches:
                css_rules[f'style:{style_name}'] = color_value.strip()
        
        # Обрабатываем все элементы, которые могут содержать текст
        for elem in soup.find_all(['p', 'span', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 
                                   'strong', 'em', 'b', 'i', 'u', 'td', 'th', 'li', 'a']):
            current_style = elem.get('style', '')
            style_dict = self._parse_style_string(current_style)
            
            # Если цвет уже есть в inline стилях, сохраняем его
            if 'color' in style_dict:
                # Цвет уже есть, просто нормализуем стили
                if style_dict:
                    style_string = '; '.join([f'{k}: {v}' for k, v in style_dict.items()])
                    elem['style'] = style_string
                continue
            
            # Проверяем классы элемента
            elem_classes = elem.get('class', [])
            if isinstance(elem_classes, str):
                elem_classes = elem_classes.split()
            elif elem_classes is None:
                elem_classes = []
            
            # Проверяем, есть ли цвет в CSS классах
            color_found = False
            for class_name in elem_classes:
                if class_name in css_rules:
                    color_value = css_rules[class_name]
                    style_dict['color'] = color_value
                    color_found = True
                    break
            
            # Проверяем теговые селекторы
            if not color_found:
                tag_selector = f'tag:{elem.name}'
                if tag_selector in css_rules:
                    style_dict['color'] = css_rules[tag_selector]
                    color_found = True
            
            # Проверяем атрибут style-name (используется Pandoc для стилей Word)
            if not color_found:
                style_name = elem.get('data-style-name') or elem.get('class')
                if style_name:
                    if isinstance(style_name, list):
                        for sn in style_name:
                            style_selector = f'style:{sn}'
                            if style_selector in css_rules:
                                style_dict['color'] = css_rules[style_selector]
                                color_found = True
                                break
                    else:
                        style_selector = f'style:{style_name}'
                        if style_selector in css_rules:
                            style_dict['color'] = css_rules[style_selector]
                            color_found = True
            
            # Сохраняем обновленные стили
            if style_dict:
                style_string = '; '.join([f'{k}: {v}' for k, v in style_dict.items()])
                elem['style'] = style_string
            elif current_style:
                # Если были стили, но они не попали в словарь, сохраняем как есть
                elem['style'] = current_style
    
    def _parse_style_string(self, style_str):
        """
        Парсит строку стилей в словарь.
        
        Args:
            style_str: Строка стилей вида "color: red; font-size: 12px;"
            
        Returns:
            Словарь с ключами-значениями стилей
        """
        style_dict = {}
        if not style_str:
            return style_dict
        
        # Разбиваем по точкам с запятой
        parts = [p.strip() for p in style_str.split(';') if p.strip()]
        for part in parts:
            if ':' in part:
                key, value = part.split(':', 1)
                key = key.strip().lower()
                value = value.strip()
                style_dict[key] = value
        
        return style_dict
    
    def _preserve_cell_text_styles(self, cell):
        """
        Сохраняет стили текста (цвет, размер, шрифт) в содержимом ячейки таблицы.
        Обрабатывает span, p и другие элементы внутри ячейки.
        """
        # Обрабатываем все текстовые элементы внутри ячейки
        for text_elem in cell.find_all(['span', 'p', 'strong', 'em', 'b', 'i', 'u']):
            # Получаем текущие стили элемента
            elem_style = text_elem.get('style', '')
            style_dict = self._parse_style_string(elem_style)
            
            # Сохраняем все стили (цвет, размер шрифта, шрифт и т.д.)
            # BeautifulSoup должен сохранить их автоматически, но убеждаемся
            if style_dict:
                style_string = '; '.join([f'{k}: {v}' for k, v in style_dict.items()])
                text_elem['style'] = style_string
            elif elem_style:
                # Если были стили, но они не попали в словарь, сохраняем как есть
                text_elem['style'] = elem_style
        
        # Также обрабатываем прямой текст в ячейке - оборачиваем в span, если нужно
        # Но это сложно, поэтому просто убеждаемся, что стили ячейки применяются к содержимому
        # Если в ячейке есть только текст без обертки, стили ячейки применятся автоматически
    
    def _convert_paragraphs(self, soup):
        """
        Обрабатывает параграфы, добавляя Bootstrap классы для отступов.
        """
        for p in soup.find_all('p'):
            p_classes = ['mb-3']
            
            existing_classes = p.get('class', [])
            if isinstance(existing_classes, str):
                existing_classes = existing_classes.split()
            elif existing_classes is None:
                existing_classes = []
            
            # Объединить классы
            all_classes = list(set(existing_classes + p_classes))
            p['class'] = all_classes
    
    def _convert_blocks_to_cards(self, soup):
        """
        Конвертирует блоки с рамками/фоном в Bootstrap карточки (опционально).
        Пока не реализовано автоматическое определение, так как это может быть слишком агрессивно.
        """
        # Можно добавить логику определения блоков с рамками
        # и конвертации их в card, но пока оставляем как есть
        # чтобы не нарушить существующую структуру
        pass

