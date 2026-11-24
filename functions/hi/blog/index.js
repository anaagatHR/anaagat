// /hi/blog: the Hindi blog page, listing the same posts (written in English for now).
import { renderBlogList } from '../../blog/index.js';

export const onRequestGet = (ctx) => renderBlogList(ctx, '/hi/blog/', 'hi-IN');
